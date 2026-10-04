// 用户在多件都符合时点选一件。重新报价、重新判定，再落一版购物车。不信任前端传来的金额和结果。
import { AppError } from "@/contracts/errors";
import { hkdToMinor } from "@/contracts/money";
import type { Decision } from "@/contracts/schemas";
import { createCartVersion } from "@/server/catalog/cart";
import { quoteCart } from "@/server/catalog/quote";
import { getProductByIdTx } from "@/server/catalog/search";
import { withTransaction } from "@/server/db/tx";
import { lockMandateSnapshot } from "@/server/mandates/service";
import { extractIntentFallback } from "./fallback";
import { judgeQuotedProduct } from "./judge";
import { buildMerchantInfo, getFirstMethod } from "./run";

export interface Selection {
  cartId: string;
  cartVersion: number;
  outcome: Decision["outcome"];
  productId: string;
  name: string;
  merchantName: string;
  totalMinor: string;
  methodId: string;
  explicit: boolean;
}

interface StoredCandidate {
  product?: { id?: string };
  merchant?: { name?: string };
  decision?: { outcome?: string };
}

export async function selectCandidate(userId: string, taskId: string, productId: string): Promise<Selection> {
  return withTransaction(async (tx) => {
    const task = await tx.query<{ id: string; status: string; mandate_id: string; input_text: string }>(
      `SELECT t.id, t.status, t.mandate_id, t.input_text FROM tasks t JOIN mandates m ON m.id=t.mandate_id
       WHERE t.id=$1 AND t.user_id=$2 AND m.user_id=$2`,
      [taskId, userId],
    );
    const row = task.rows[0];
    if (!row) throw new AppError("NOT_FOUND", "任务不存在。");
    // 与结算共用授权锁；拿锁后重读任务和付款状态，避免改选与付款交错。
    const mandate = await lockMandateSnapshot(tx, row.mandate_id);
    if (!mandate) throw new AppError("NOT_FOUND", "授权书不存在。");
    const currentTask = await tx.query<{ status: string }>(`SELECT status FROM tasks WHERE id=$1`, [taskId]);
    if (currentTask.rows[0]?.status !== "awaiting_confirmation") {
      throw new AppError("VALIDATION_ERROR", "这单已经不能改选商品。");
    }

    const paid = await tx.query<{ id: string }>(
      `SELECT id FROM orders WHERE task_id=$1 AND user_id=$2 AND status='paid' LIMIT 1`,
      [taskId, userId],
    );
    if ((paid.rowCount ?? 0) > 0) throw new AppError("VALIDATION_ERROR", "这单已经付过款。");

    const run = await tx.query<{ candidates: unknown }>(
      `SELECT candidates FROM agent_runs WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [taskId],
    );
    const candidates = Array.isArray(run.rows[0]?.candidates) ? (run.rows[0].candidates as StoredCandidate[]) : [];
    const listed = candidates.find((c) => c.product?.id === productId);
    if (!listed) throw new AppError("VALIDATION_ERROR", "这件不在这次找到的商品里。");
    if (listed.decision?.outcome === "DENY") throw new AppError("DECISION_DENY", "这件被拒绝，不能选。");

    const product = await getProductByIdTx(tx, productId);
    if (!product) throw new AppError("NOT_FOUND", "这件商品现在不能买。");

    const buyerCred = await tx.query<{ status: string }>(
      `SELECT status FROM credentials WHERE subject_type='buyer' AND subject_id=$1 AND type='agentic_id'`,
      [userId],
    );
    const rawStatus = buyerCred.rows[0]?.status;
    const buyerCredentialStatus =
      rawStatus === "valid" || rawStatus === "revoked" || rawStatus === "expired" ? rawStatus : "missing";

    const method = await getFirstMethod(tx, userId, mandate.allowedMethods, product.merchant_accepts_methods);
    const merchant = buildMerchantInfo(product);
    const qty = extractIntentFallback(row.input_text).qty;
    if (product.stock_qty < qty) throw new AppError("OUT_OF_STOCK", "这件商品库存不足。");
    const quote = quoteCart(merchant, [{ ...product, qty }], method);
    const range = mandate.task.priceRangeHKD;
    if (range) {
      const minPrice = hkdToMinor(range.min);
      const maxPrice = hkdToMinor(range.max);
      if (quote.totalMinor < minPrice || quote.totalMinor > maxPrice) {
        throw new AppError("VALIDATION_ERROR", "这件不在你写的价格范围内。");
      }
    }
    const decision = judgeQuotedProduct({
      now: new Date(),
      mandate,
      buyerCredentialStatus,
      product,
      merchant,
      quote,
      method,
    });
    if (decision.outcome === "DENY") {
      throw new AppError("DECISION_DENY", "规则拒绝了这件，不能选。");
    }

    const cartVersion = await createCartVersion(tx, taskId, merchant.id, quote, method.id);
    await tx.query(
      `INSERT INTO decisions (task_id, cart_id, cart_version, checkpoint, outcome, rules, mandate_version, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '{"selection":"explicit"}')`,
      [
        taskId,
        cartVersion.cartId,
        cartVersion.version,
        decision.checkpoint,
        decision.outcome,
        JSON.stringify(decision.rules),
        decision.mandateVersion,
      ],
    );

    const item = quote.items[0];
    return {
      cartId: cartVersion.cartId,
      cartVersion: cartVersion.version,
      outcome: decision.outcome,
      productId: item?.productId ?? product.id,
      name: item?.name ?? product.name,
      merchantName: merchant.name,
      totalMinor: quote.totalMinor.toString(),
      methodId: method.id,
      explicit: true,
    };
  });
}
