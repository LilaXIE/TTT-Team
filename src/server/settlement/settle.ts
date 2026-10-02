// 结算事务。规格：docs/MANUAL.md §6.3 伪代码与 AGENTS.md 不变量 2–7。
import { createHash } from "node:crypto";
import { AppError } from "@/contracts/errors";
import type { EngineContext, MandateSnapshot } from "@/contracts/schemas";
import { getCartVersion, type CartVersionSnapshot } from "@/server/catalog/cart";
import { withTransaction, type Tx } from "@/server/db/tx";
import { lockMandateSnapshot } from "@/server/mandates/service";
import { decide } from "@/server/rules/engine";
import { isCovered } from "@/server/rules/confirmation";

export interface SettleRequest {
  orderId?: string;
  cartId?: string;
  cartVersion?: number;
  userId: string;
  idempotencyKey: string;
  methodId: string;
}

export interface SettleResult {
  status: "succeeded" | "denied" | "review_required";
  orderId: string;
  transactionId: string;
  totalMinor: string;
  decisionOutcome: "ALLOW" | "DENY" | "REVIEW";
  decisionRules: unknown[];
  paidAt?: string;
  reason?: string;
}

/**
 * 结算：一个事务内完成授权扣减、库存、余额、账本。
 * 不变量 2–7（AGENTS.md）：事务内重新构造 ctx 并调用 decide(PAY)；固定取锁顺序；条件更新。
 */
export async function settle(req: SettleRequest): Promise<SettleResult> {
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        orderId: req.orderId,
        cartId: req.cartId,
        cartVersion: req.cartVersion,
        methodId: req.methodId,
      }),
    )
    .digest("hex");

  return withTransaction(async (tx) => {
    // 1. 幂等：payment_attempts 插入冲突时比较 request_hash
    const attemptId = await insertAttempt(tx, req.userId, req.idempotencyKey, requestHash);
    if (!attemptId) {
      const existing = await tx.query<{ id: string; request_hash: string; status: string; result: unknown }>(
        `SELECT id, request_hash, status, result FROM payment_attempts WHERE user_id=$1 AND idempotency_key=$2`,
        [req.userId, req.idempotencyKey],
      );
      if (existing.rowCount === 0) throw new AppError("INTERNAL", "幂等键冲突但找不到记录。");
      const ex = existing.rows[0];
      if (ex.request_hash !== requestHash) {
        throw new AppError("IDEMPOTENCY_CONFLICT", "幂等键已用于不同请求。", { status: 409 });
      }
      // 返回保存的结果
      return ex.result as SettleResult;
    }

    // 2. 读取或创建订单
    let orderId = req.orderId;
    if (!orderId) {
      if (!req.cartId || !req.cartVersion) {
        throw new AppError("VALIDATION_ERROR", "必须提供 orderId 或 (cartId + cartVersion)。");
      }
      orderId = await getOrCreateOrder(tx, req.cartId, req.cartVersion, req.userId, req.methodId);
    }

    // 3. 固定取锁顺序（AGENTS.md 不变量 5）
    const order = await lockOrder(tx, orderId, req.userId);
    if (!order) throw new AppError("NOT_FOUND", "订单不存在。");
    if (order.status !== "pending") {
      return buildResult(attemptId, order, "denied", "订单已支付或已取消。");
    }

    const cart = await getCartVersion(tx, order.cart_id, order.cart_version);
    if (!cart) throw new AppError("NOT_FOUND", "购物车版本不存在。");

    const mandate = await lockMandateSnapshot(tx, order.mandate_id);
    if (!mandate) throw new AppError("NOT_FOUND", "授权书不存在。");

    const buyerCred = await lockBuyerCredential(tx, req.userId);
    const merchantCred = await lockMerchantCredential(tx, cart.merchantId);
    const products = await lockProducts(tx, cart.items.map((i) => i.productId));
    const buyerAccount = await lockAccount(tx, "buyer", req.userId);
    const merchantAccount = await lockAccount(tx, "merchant", cart.merchantId);

    // 4. 用锁内数据构造 EngineContext，重新调用 decide(PAY)
    const ctx = buildEngineContext(
      mandate,
      buyerCred,
      merchantCred,
      products,
      cart,
      req.methodId,
      new Date(),
    );
    const decision = decide(ctx, "PAY");
    await saveDecision(tx, order.task_id, cart.cartId, cart.version, decision);

    // DENY → 记录 declined，提交，返回
    if (decision.outcome === "DENY") {
      await updateAttempt(tx, attemptId, "denied", { decision });
      return buildResult(attemptId, order, "denied", decision.rules[0]?.message ?? "被拒绝");
    }

    // REVIEW → 检查 confirmation
    if (decision.outcome === "REVIEW") {
      const confirmation = await getConfirmation(tx, cart.cartId, cart.version);
      const coverage = isCovered(decision, confirmation, cart.version, new Date());
      if (!coverage.covered) {
        await updateAttempt(tx, attemptId, "review", { decision, coverage });
        return buildResult(attemptId, order, "review_required", `需要确认：${coverage.reason}`);
      }
    }

    // 5. 模拟发卡行拒绝（演示）
    const issuerDecline = await checkIssuerDecline(tx);
    if (issuerDecline) {
      await updateAttempt(tx, attemptId, "denied", { reason: "ISSUER_DECLINED" });
      return buildResult(attemptId, order, "denied", "发卡行拒绝");
    }

    // 6. 条件更新（不变量 3、4）
    const totalMinor = cart.totalMinor;
    await conditionalUpdateMandate(tx, mandate.id, totalMinor, mandate.version);
    await conditionalUpdateProducts(tx, cart.items);
    await conditionalUpdateAccount(tx, buyerAccount.id, -totalMinor, "buyer");
    await conditionalUpdateAccount(tx, merchantAccount.id, totalMinor, "merchant");
    await conditionalUpdateOrder(tx, orderId);

    // 7. 账本（AGENTS.md 不变量 2: 结算自己写 journal）
    await postSale(tx, orderId, buyerAccount.id, merchantAccount.id, totalMinor);

    // 8. remaining_purchases 变为 0 → mandate.status='completed'
    const remaining = await tx.query<{ remaining_purchases: number }>(
      `SELECT remaining_purchases FROM mandates WHERE id=$1`,
      [mandate.id],
    );
    if (remaining.rows[0]?.remaining_purchases === 0) {
      await tx.query(`UPDATE mandates SET status='completed' WHERE id=$1 AND status='active'`, [mandate.id]);
      await tx.query(`UPDATE tasks SET status='completed' WHERE mandate_id=$1 AND status!='completed'`, [
        mandate.id,
      ]);
    }

    // 9. 更新 attempt
    const receipt = {
      orderId,
      transactionId: attemptId,
      totalMinor: totalMinor.toString(),
      methodId: req.methodId,
      merchant: cart.merchantId,
      items: cart.items,
      paidAt: new Date().toISOString(),
      decision,
    };
    await updateAttempt(tx, attemptId, "succeeded", receipt);
    await tx.query(
      `INSERT INTO audit_events (actor, action, entity, entity_id, payload)
       VALUES ($1, 'payment.settle', 'order', $2, $3)`,
      [`user:${req.userId}`, orderId, JSON.stringify({ totalMinor: totalMinor.toString() })],
    );

    return buildResult(attemptId, order, "succeeded", undefined, receipt.paidAt);
  }, { lockTimeoutMs: 3000, statementTimeoutMs: 10000, retries: 2 });
}

async function insertAttempt(
  tx: Tx,
  userId: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<string | null> {
  try {
    const r = await tx.query<{ id: string }>(
      `INSERT INTO payment_attempts (user_id, idempotency_key, request_hash, status, result)
       VALUES ($1, $2, $3, 'pending', '{}') RETURNING id`,
      [userId, idempotencyKey, requestHash],
    );
    return r.rows[0].id;
  } catch (e) {
    // 冲突时返回 null，由调用者处理
    if ((e as { code?: string }).code === "23505") return null;
    throw e;
  }
}

async function getOrCreateOrder(
  tx: Tx,
  cartId: string,
  cartVersion: number,
  userId: string,
  methodId: string,
): Promise<string> {
  const existing = await tx.query<{ id: string }>(
    `SELECT id FROM orders WHERE cart_id=$1 AND cart_version=$2`,
    [cartId, cartVersion],
  );
  if (existing.rowCount && existing.rowCount > 0) return existing.rows[0].id;

  const cart = await getCartVersion(tx, cartId, cartVersion);
  if (!cart) throw new AppError("NOT_FOUND", "购物车版本不存在。");

  const task = await tx.query<{ id: string; mandate_id: string }>(
    `SELECT id, mandate_id FROM tasks WHERE id=(SELECT task_id FROM carts WHERE id=$1)`,
    [cartId],
  );
  if (task.rowCount === 0) throw new AppError("NOT_FOUND", "任务不存在。");

  const r = await tx.query<{ id: string }>(
    `INSERT INTO orders (task_id, cart_id, cart_version, user_id, merchant_id, total_minor, method_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING id`,
    [task.rows[0].id, cartId, cartVersion, userId, cart.merchantId, cart.totalMinor.toString(), methodId],
  );
  return r.rows[0].id;
}

interface OrderRow {
  id: string;
  task_id: string;
  cart_id: string;
  cart_version: number;
  mandate_id: string;
  status: string;
  total_minor: string;
}

async function lockOrder(tx: Tx, orderId: string, userId: string): Promise<OrderRow | null> {
  const r = await tx.query<OrderRow>(
    `SELECT o.id, o.task_id, o.cart_id, o.cart_version, o.status, o.total_minor, t.mandate_id
     FROM orders o
     JOIN tasks t ON t.id = o.task_id
     WHERE o.id=$1 AND o.user_id=$2
     FOR UPDATE OF o`,
    [orderId, userId],
  );
  return r.rows[0] ?? null;
}

async function lockBuyerCredential(tx: Tx, userId: string) {
  const r = await tx.query<{ status: string }>(
    `SELECT status FROM credentials WHERE subject_type='buyer' AND subject_id=$1 AND type='agentic_id' FOR UPDATE`,
    [userId],
  );
  return { status: r.rows[0]?.status ?? "missing" };
}

async function lockMerchantCredential(tx: Tx, merchantId: string) {
  const r = await tx.query<{ status: string }>(
    `SELECT status FROM credentials WHERE subject_type='merchant' AND subject_id=$1 AND type='merchant_license' FOR UPDATE`,
    [merchantId],
  );
  return { status: r.rows[0]?.status ?? "missing", registeredAt: new Date() };
}

async function lockProducts(tx: Tx, productIds: string[]) {
  const sorted = [...productIds].sort();
  const r = await tx.query<{
    id: string;
    category: string;
    brand: string;
    spec: Record<string, number>;
    price_minor: string;
    ref_price_minor: string;
    risk_tags: string[];
    stock_qty: number;
  }>(
    `SELECT id, category, brand, spec, price_minor, ref_price_minor, risk_tags, stock_qty
     FROM products WHERE id = ANY($1) ORDER BY id FOR UPDATE`,
    [sorted],
  );
  return r.rows;
}

async function lockAccount(tx: Tx, ownerType: string, ownerId: string) {
  const r = await tx.query<{ id: string; balance_minor: string }>(
    `SELECT id, balance_minor FROM accounts WHERE owner_type=$1 AND owner_id=$2 FOR UPDATE`,
    [ownerType, ownerId],
  );
  if (r.rowCount === 0) throw new AppError("NOT_FOUND", `账户不存在：${ownerType}/${ownerId}`);
  return r.rows[0];
}

function buildEngineContext(
  mandate: MandateSnapshot,
  buyerCred: { status: string },
  merchantCred: { status: string; registeredAt: Date },
  products: Array<{ id: string; category: string; brand: string; spec: Record<string, number>; price_minor: string; ref_price_minor: string; risk_tags: string[]; stock_qty: number }>,
  cart: CartVersionSnapshot,
  methodId: string,
  now: Date,
): EngineContext {
  return {
    now,
    mandate,
    buyerCredential: { status: buyerCred.status as "valid" | "revoked" | "expired" | "missing" },
    merchant: {
      id: cart.merchantId,
      name: cart.merchantId,
      credentialStatus: merchantCred.status as "valid" | "revoked" | "expired" | "missing",
      registeredAt: merchantCred.registeredAt,
    },
    cart: {
      version: cart.version,
      items: cart.items.map((item) => {
        const p = products.find((x) => x.id === item.productId);
        return {
          id: item.productId,
          category: item.category,
          brand: item.brand,
          spec: item.spec,
          priceMinor: item.unitPriceMinor,
          refPriceMinor: item.refPriceMinor,
          riskTags: item.riskTags,
          qty: item.qty,
        };
      }),
      subtotalMinor: cart.subtotalMinor,
      shippingMinor: cart.shippingMinor,
      consumerFeeMinor: cart.consumerFeeMinor,
      totalMinor: cart.totalMinor,
      quoteExpiresAt: cart.quoteExpiresAt,
    },
    paymentMethod: {
      id: methodId,
      label: methodId,
      merchantAccepts: true,
      userEnabled: true,
    },
  };
}

async function saveDecision(tx: Tx, taskId: string, cartId: string, cartVersion: number, decision: unknown) {
  await tx.query(
    `INSERT INTO decisions (task_id, cart_id, cart_version, checkpoint, outcome, rules, mandate_version, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '{}')`,
    [taskId, cartId, cartVersion, (decision as { checkpoint: string }).checkpoint, (decision as { outcome: string }).outcome, JSON.stringify((decision as { rules: unknown }).rules), (decision as { mandateVersion: number }).mandateVersion],
  );
}

async function getConfirmation(tx: Tx, cartId: string, cartVersion: number) {
  const r = await tx.query<{ rule_ids: string[]; expires_at: Date }>(
    `SELECT rule_ids, expires_at FROM confirmations
     WHERE cart_id=$1 AND cart_version=$2 AND expires_at > now()
     ORDER BY confirmed_at DESC LIMIT 1`,
    [cartId, cartVersion],
  );
  if (r.rowCount === 0) return null;
  return {
    cartVersion,
    ruleIds: r.rows[0].rule_ids,
    expiresAt: r.rows[0].expires_at,
  };
}

async function checkIssuerDecline(tx: Tx): Promise<boolean> {
  const r = await tx.query<{ value: boolean }>(
    `SELECT (payload->>'next_issuer_decline')::boolean AS value
     FROM audit_events WHERE action='demo.issuer_decline'
     ORDER BY created_at DESC LIMIT 1`,
  );
  if (r.rowCount === 0 || !r.rows[0].value) return false;
  // 清除标记
  await tx.query(
    `INSERT INTO audit_events (actor, action, entity, entity_id, payload)
     VALUES ('system', 'demo.issuer_decline_used', 'demo', 'main', '{}')`,
  );
  return true;
}

async function conditionalUpdateMandate(tx: Tx, mandateId: string, totalMinor: bigint, version: number) {
  const r = await tx.query(
    `UPDATE mandates SET
       remaining_minor = remaining_minor - $1::bigint,
       remaining_purchases = remaining_purchases - 1
     WHERE id=$2 AND version=$3 AND status='active' AND expires_at > now()
       AND remaining_minor >= $1::bigint AND remaining_purchases > 0`,
    [totalMinor.toString(), mandateId, version],
  );
  if (r.rowCount === 0) {
    const check = await tx.query<{ status: string; remaining_minor: string; remaining_purchases: number }>(
      `SELECT status, remaining_minor, remaining_purchases FROM mandates WHERE id=$1`,
      [mandateId],
    );
    if (check.rowCount === 0) throw new AppError("MANDATE_REVOKED", "授权书不存在。");
    const m = check.rows[0];
    if (m.status !== "active") throw new AppError("MANDATE_REVOKED", `授权书状态为 ${m.status}。`);
    if (BigInt(m.remaining_minor) < totalMinor) throw new AppError("CAP_TOTAL", "剩余额度不足。");
    if (m.remaining_purchases <= 0) throw new AppError("USES_EXHAUSTED", "剩余次数不足。");
    throw new AppError("MANDATE_EXPIRED", "授权书已过期。");
  }
}

async function conditionalUpdateProducts(tx: Tx, items: Array<{ productId: string; qty: number }>) {
  for (const item of items) {
    const r = await tx.query(
      `UPDATE products SET stock_qty = stock_qty - $1 WHERE id=$2 AND stock_qty >= $1`,
      [item.qty, item.productId],
    );
    if (r.rowCount === 0) throw new AppError("OUT_OF_STOCK", `商品 ${item.productId} 库存不足。`);
  }
}

async function conditionalUpdateAccount(tx: Tx, accountId: string, deltaMinor: bigint, ownerType: string) {
  const r = await tx.query(
    `UPDATE accounts SET balance_minor = balance_minor + $1::bigint
     WHERE id=$2 AND ($3='treasury' OR balance_minor + $1::bigint >= 0)`,
    [deltaMinor.toString(), accountId, ownerType],
  );
  if (r.rowCount === 0) {
    throw new AppError("INSUFFICIENT_FUNDS", "余额不足。");
  }
}

async function conditionalUpdateOrder(tx: Tx, orderId: string) {
  const r = await tx.query(
    `UPDATE orders SET status='paid', paid_at=now() WHERE id=$1 AND status='pending'`,
    [orderId],
  );
  if (r.rowCount === 0) throw new AppError("ORDER_NOT_PENDING", "订单不是 pending 状态。");
}

async function postSale(tx: Tx, orderId: string, buyerAccId: string, merchantAccId: string, totalMinor: bigint) {
  const j = await tx.query<{ id: string }>(
    `INSERT INTO journals (type, order_id, memo) VALUES ('SALE', $1, 'payment') RETURNING id`,
    [orderId],
  );
  const journalId = j.rows[0].id;
  await tx.query(
    `INSERT INTO ledger_entries (journal_id, account_id, amount_minor) VALUES ($1, $2, $3)`,
    [journalId, buyerAccId, (-totalMinor).toString()],
  );
  await tx.query(
    `INSERT INTO ledger_entries (journal_id, account_id, amount_minor) VALUES ($1, $2, $3)`,
    [journalId, merchantAccId, totalMinor.toString()],
  );
}

async function updateAttempt(tx: Tx, attemptId: string, status: string, result: unknown) {
  await tx.query(`UPDATE payment_attempts SET status=$1, result=$2 WHERE id=$3`, [
    status,
    JSON.stringify(result),
    attemptId,
  ]);
}

function buildResult(
  attemptId: string,
  order: OrderRow,
  status: "succeeded" | "denied" | "review_required",
  reason?: string,
  paidAt?: string,
): SettleResult {
  return {
    status,
    orderId: order.id,
    transactionId: attemptId,
    totalMinor: order.total_minor,
    decisionOutcome: status === "succeeded" ? "ALLOW" : status === "denied" ? "DENY" : "REVIEW",
    decisionRules: [],
    ...(paidAt ? { paidAt } : {}),
    ...(reason ? { reason } : {}),
  };
}
