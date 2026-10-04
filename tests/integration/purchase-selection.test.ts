import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool } from "@/server/db/pool";
import { query, withTransaction } from "@/server/db/tx";
import { resetDemo } from "@/server/seed";
import { createMandate } from "@/server/mandates/service";
import { runTask } from "@/server/agent/run";
import { selectCandidate, type Selection } from "@/server/agent/select";
import { settle } from "@/server/settlement/settle";
import { readTask } from "@/server/tasks/read";

describe("商品选择与结算边界（独立 PostgreSQL）", () => {
  let userId: string;
  beforeEach(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
    userId = await withTransaction(resetDemo, { statementTimeoutMs: 60_000 });
  });
  afterAll(closePool);

  async function task(options: { review?: boolean; methods?: string[]; range?: { min: string; max: string }; newMerchant?: boolean } = {}) {
    const mandate = await createMandate(userId, {
      taskText: "洗衣液", task: { query: "洗衣液", qty: 1, minSpec: { volumeMl: 2000 }, allowSubstituteBrand: true, preferredBrand: null, priceRangeHKD: options.range },
      categories: ["household"], merchantDeny: [], perTxnHKD: "200", totalHKD: "400", maxPurchases: 2,
      expiresAt: new Date(Date.now() + 86400000).toISOString(), protectionLevel: "standard",
      reviewWhen: { nearCapPct: null, substituteBrand: false, watchCategories: options.review ? ["household"] : [], newMerchantDays: options.newMerchant ? 30 : null, priceAboveRefPct: null },
      allowedMethods: options.methods ?? ["fps", "tapngo_mc"],
    });
    const inserted = await query<{ id: string }>(`INSERT INTO tasks (user_id, mandate_id, status, input_text) VALUES ($1,$2,'running','洗衣液') RETURNING id`, [userId, mandate.id]);
    const id = inserted.rows[0].id;
    const result = await runTask({ taskId: id, userId, mandateId: mandate.id, inputText: "洗衣液" });
    return { id, mandate, result };
  }

  const pay = (selection: Selection, key = randomUUID()) => settle({ ...selection, userId, idempotencyKey: key });
  async function balance() {
    return (await query<{ balance_minor: string }>(`SELECT balance_minor FROM accounts WHERE owner_type='buyer' AND owner_id=$1`, [userId])).rows[0].balance_minor;
  }
  async function confirm(id: string, selection: Selection) {
    await query(`INSERT INTO confirmations (user_id, task_id, cart_id, cart_version, rule_ids, expires_at) VALUES ($1,$2,$3,$4,ARRAY['WATCH_CATEGORY'],now()+interval '30 minutes')`, [userId, id, selection.cartId, selection.cartVersion]);
  }

  it("多个候选不预建默认付款购物车", async () => {
    const t = await task();
    expect(t.result.candidates.length).toBeGreaterThan(1);
    expect(t.result.selectedCartId).toBeUndefined();
    expect((await query(`SELECT id FROM carts WHERE task_id=$1`, [t.id])).rowCount).toBe(0);
    expect(await balance()).toBe("150000");
  });

  it("只购买选中的商家商品，订单和账本金额一致", async () => {
    const t = await task();
    const s = await selectCandidate(userId, t.id, "B-LD-001");
    expect((await readTask(userId, t.id)).cart).toMatchObject({ productId: "B-LD-001", explicit: true, methodId: s.methodId });
    const result = await pay(s);
    expect(result.status).toBe("succeeded");
    const orders = await query(`SELECT merchant_id,total_minor::text AS total FROM orders WHERE task_id=$1 AND status='paid'`, [t.id]);
    expect(orders.rows).toEqual([{ merchant_id: "B", total: s.totalMinor }]);
    expect((await readTask(userId, t.id)).paid).toMatchObject({ productId: "B-LD-001", totalMinor: s.totalMinor });
    expect((await query<{ total: string }>(`SELECT SUM(amount_minor)::text AS total FROM ledger_entries WHERE journal_id IN (SELECT id FROM journals WHERE order_id=$1)`, [result.orderId])).rows[0].total).toBe("0");
    await expect(selectCandidate(userId, t.id, "A-LD-001")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("他人的任务和非候选商品不能被选择或支付", async () => {
    const t = await task();
    await expect(selectCandidate(randomUUID(), t.id, "A-LD-001")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(selectCandidate(userId, t.id, "C-SUP-001")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    await expect(settle({ ...s, userId: randomUUID(), idempotencyKey: randomUUID() })).rejects.toThrow();
    expect(await balance()).toBe("150000");
  });

  it("跨商家改选后旧购物车不可付；旧付款尝试也不能恢复旧选择", async () => {
    const t = await task();
    const old = await selectCandidate(userId, t.id, "A-LD-001");
    const current = await selectCandidate(userId, t.id, "B-LD-001");
    await expect(pay(old)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await pay(current)).status).toBe("succeeded");
    expect(await balance()).toBe((150000n - BigInt(current.totalMinor)).toString());
  });

  it("旧版本自动挑的购物车必须由用户重新选择才能付款", async () => {
    const t = await task();
    const old = await selectCandidate(userId, t.id, "A-LD-001");
    await query(`UPDATE decisions SET context='{}' WHERE task_id=$1`, [t.id]);
    expect((await readTask(userId, t.id)).cart?.explicit).toBe(false);
    await expect(pay(old)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const selected = await selectCandidate(userId, t.id, "A-LD-001");
    expect((await pay(selected)).status).toBe("succeeded");
  });

  it("候选只有一件时保留原先的直接确认付款流程", async () => {
    await query(`UPDATE products SET status='draft' WHERE id!='A-LD-001'`);
    const t = await task();
    expect(t.result.candidates).toHaveLength(1);
    const current = (await readTask(userId, t.id)).cart;
    expect(current?.explicit).toBe(false);
    expect((await settle({ cartId: current!.cartId, cartVersion: current!.cartVersion, methodId: current!.methodId, userId, idempotencyKey: randomUUID() })).status).toBe("succeeded");
  });

  it("同商品刷新也生成新版本，旧 REVIEW 确认不能覆盖新版本", async () => {
    const t = await task({ review: true });
    const old = await selectCandidate(userId, t.id, "A-LD-001");
    await confirm(t.id, old);
    const current = await selectCandidate(userId, t.id, "A-LD-001");
    expect(current.cartVersion).toBeGreaterThan(old.cartVersion);
    await expect(pay(old)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await pay(current)).status).toBe("review_required");
    expect(await balance()).toBe("150000");
    await confirm(t.id, current);
    expect((await pay(current)).status).toBe("succeeded");
  });

  it("确认过期不能支付，DENY 不会被旧确认绕过", async () => {
    const t = await task({ review: true });
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    await confirm(t.id, s);
    await query(`UPDATE confirmations SET expires_at=now()-interval '1 minute' WHERE task_id=$1`, [t.id]);
    expect((await pay(s)).status).toBe("review_required");
    await confirm(t.id, s);
    await query(`UPDATE mandates SET status='revoked' WHERE id=$1`, [t.mandate.id]);
    expect((await pay(s)).status).toBe("denied");
    await expect(selectCandidate(userId, t.id, "A-LD-001")).rejects.toMatchObject({ code: "DECISION_DENY" });
    expect(await balance()).toBe("150000");
  });

  it("并发改选串行化，只有最后选中的版本可以付", async () => {
    const t = await task();
    const selections = await Promise.all([selectCandidate(userId, t.id, "A-LD-001"), selectCandidate(userId, t.id, "B-LD-001")]);
    const results = await Promise.allSettled(selections.map((s) => pay(s)));
    expect(results.filter((r) => r.status === "fulfilled" && r.value.status === "succeeded")).toHaveLength(1);
    expect((await query(`SELECT id FROM orders WHERE task_id=$1 AND status='paid'`, [t.id])).rowCount).toBe(1);
  });

  it("付款与改选并发不会把两件都买下", async () => {
    const t = await task();
    const old = await selectCandidate(userId, t.id, "A-LD-001");
    const results = await Promise.allSettled([pay(old), selectCandidate(userId, t.id, "B-LD-001")]);
    const selection = results[1];
    if (selection.status === "fulfilled") await pay(selection.value as Selection);
    expect((await query(`SELECT id FROM orders WHERE task_id=$1 AND status='paid'`, [t.id])).rowCount).toBe(1);
  });

  it("重复点击使用不同幂等键也只扣款一次", async () => {
    const t = await task();
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    const results = await Promise.allSettled([pay(s), pay(s)]);
    expect(results.filter((r) => r.status === "fulfilled" && r.value.status === "succeeded")).toHaveLength(1);
    expect(await balance()).toBe((150000n - BigInt(s.totalMinor)).toString());
  });

  it("任务取消后旧页面的付款按钮不能扣款", async () => {
    const t = await task();
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    await query(`UPDATE tasks SET status='cancelled' WHERE id=$1`, [t.id]);
    await expect(pay(s)).rejects.toMatchObject({ code: "ORDER_NOT_PENDING" });
    expect(await balance()).toBe("150000");
  });

  it("网络重试并发使用同一幂等键会返回同一张收据", async () => {
    const t = await task();
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    const key = randomUUID();
    const results = await Promise.all([pay(s, key), pay(s, key)]);
    expect(results[0]).toEqual(results[1]);
    expect(await balance()).toBe((150000n - BigInt(s.totalMinor)).toString());
  });

  it("仅 FPS 授权可以结算，不允许前端换成未报价的支付方式", async () => {
    const t = await task({ methods: ["fps"] });
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    expect(s.methodId).toBe("fps");
    await expect(pay({ ...s, methodId: "tapngo_mc" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await pay(s)).status).toBe("succeeded");
  });

  it("商家只收 FPS 时选择 FPS；付款前禁用方式则 DENY", async () => {
    await query(`UPDATE merchants SET accepts_methods=ARRAY['fps'] WHERE id='A'`);
    const t = await task();
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    expect(s.methodId).toBe("fps");
    await query(`UPDATE user_payment_methods SET enabled=false WHERE user_id=$1 AND method_id='fps'`, [userId]);
    expect((await pay(s)).status).toBe("denied");
    expect(await balance()).toBe("150000");
  });

  it("授权价格区间计入运费，超出区间的候选不会被选中", async () => {
    const t = await task({ range: { min: "100", max: "125" } });
    expect(t.result.candidates.some((c) => c.product.id === "A-LD-001")).toBe(false);
    expect(t.result.candidates.every((c) => c.quote.totalMinor <= 12500n)).toBe(true);
  });

  it("旧商家不会在结算时突然被当作刚注册商家", async () => {
    const t = await task({ newMerchant: true });
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    expect(s.outcome).toBe("ALLOW");
    expect((await pay(s)).status).toBe("succeeded");
  });

  it("报价过期或商家凭证撤销后都不扣款", async () => {
    const t = await task();
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    await query(`UPDATE cart_versions SET quote_expires_at=now()-interval '1 minute' WHERE cart_id=$1`, [s.cartId]);
    expect((await pay(s)).status).toBe("denied");
    const fresh = await selectCandidate(userId, t.id, "A-LD-001");
    await query(`UPDATE credentials SET status='revoked' WHERE subject_type='merchant' AND subject_id='A'`);
    expect((await pay(fresh)).status).toBe("denied");
    expect(await balance()).toBe("150000");
  });

  it("扣库存后余额不足，授权、库存、订单和 attempt 全部回滚", async () => {
    const t = await task();
    const s = await selectCandidate(userId, t.id, "A-LD-001");
    await query(`UPDATE accounts SET balance_minor=1 WHERE owner_type='buyer' AND owner_id=$1`, [userId]);
    const before = (await query(`SELECT stock_qty FROM products WHERE id='A-LD-001'`)).rows[0];
    await expect(pay(s)).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect((await query(`SELECT stock_qty FROM products WHERE id='A-LD-001'`)).rows[0]).toEqual(before);
    expect((await query(`SELECT remaining_minor::text,remaining_purchases FROM mandates WHERE id=$1`, [t.mandate.id])).rows[0]).toEqual({ remaining_minor: "40000", remaining_purchases: 2 });
    expect((await query(`SELECT id FROM orders WHERE task_id=$1`, [t.id])).rowCount).toBe(0);
    expect((await query(`SELECT id FROM payment_attempts WHERE user_id=$1`, [userId])).rowCount).toBe(0);
    expect(await balance()).toBe("1");
  });
});
