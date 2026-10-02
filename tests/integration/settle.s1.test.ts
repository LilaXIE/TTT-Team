// S1 集成测试：自动完成正常结算。规格：docs/MANUAL.md §10 S1。
import { describe, it, expect, beforeEach } from "vitest";
import { withTransaction } from "@/server/db/tx";
import { resetDemo } from "@/server/seed";
import { createMandate } from "@/server/mandates/service";
import { runTask } from "@/server/agent/run";
import { settle } from "@/server/settlement/settle";
import { query } from "@/server/db/tx";

async function createTask(userId: string, mandateId: string, inputText: string): Promise<string> {
  return withTransaction(async (tx) => {
    const result = await tx.query<{ id: string }>(
      `INSERT INTO tasks (user_id, mandate_id, status, input_text)
       VALUES ($1, $2, 'running', $3)
       RETURNING id`,
      [userId, mandateId, inputText],
    );
    return result.rows[0].id;
  });
}

describe("S1: 自动完成正常结算", () => {
  let userId: string;

  beforeEach(async () => {
    // 重置演示数据
    userId = await withTransaction((tx) => resetDemo(tx), { statementTimeoutMs: 60_000 });
  });

  it("帮我补一瓶洗衣液 2L 以上 150 以内 → A 家品牌甲 118+20=138 → paid", async () => {
    // 1. 创建授权：household，单笔 150，总额 300，2 次
    const mandate = await createMandate(userId, {
      taskText: "日用品补货",
      task: {
        query: "洗衣液",
        qty: 1,
        minSpec: { volumeMl: 2000 },
        allowSubstituteBrand: true,
        preferredBrand: "品牌甲",
      },
      categories: ["household"],
      merchantDeny: [],
      perTxnHKD: "150",
      totalHKD: "300",
      maxPurchases: 2,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      reviewWhen: {
        nearCapPct: 95,
        substituteBrand: false,
        watchCategories: [],
        newMerchantDays: null,
        priceAboveRefPct: null,
      },
      protectionLevel: "standard",
      allowedMethods: ["fps", "tapngo_mc"],
    });

    expect(mandate.status).toBe("active");
    expect(mandate.remainingMinor).toBe("30000");
    expect(mandate.remainingPurchases).toBe(2);

    // 2. 执行任务
    const inputText = "帮我补一瓶洗衣液，2L 以上，150 以内";
    const taskId = await createTask(userId, mandate.id, inputText);
    const taskResult = await runTask({
      taskId,
      userId,
      mandateId: mandate.id,
      inputText,
    });

    expect(taskResult.mode).toBe("fallback");
    expect(taskResult.candidates.length).toBeGreaterThan(0);

    // 验证首选是 A 家品牌甲（价格最低）
    const firstCandidate = taskResult.candidates[0];
    expect(firstCandidate.product.merchant_id).toBe("A");
    expect(firstCandidate.product.brand).toBe("品牌甲");
    expect(firstCandidate.quote.totalMinor).toBe(13800n); // 118 + 20

    // 3. 结算
    if (!taskResult.selectedCartId || !taskResult.selectedCartVersion) {
      throw new Error("未创建购物车");
    }

    const settleResult = await settle({
      cartId: taskResult.selectedCartId,
      cartVersion: taskResult.selectedCartVersion,
      userId,
      idempotencyKey: `test-${Date.now()}`,
      methodId: "fps",
    });

    expect(settleResult.status).toBe("succeeded");
    expect(settleResult.decisionOutcome).toBe("ALLOW");
    expect(settleResult.totalMinor).toBe("13800");

    // 4. 验证数据库状态
    const order = await query<{ status: string; total_minor: string }>(
      `SELECT status, total_minor FROM orders WHERE id=$1`,
      [settleResult.orderId],
    );
    expect(order.rows[0].status).toBe("paid");
    expect(order.rows[0].total_minor).toBe("13800");

    // 买家余额：150000 - 13800 = 136200
    const buyerAcc = await query<{ balance_minor: string }>(
      `SELECT balance_minor FROM accounts WHERE owner_type='buyer' AND owner_id=$1`,
      [userId],
    );
    expect(buyerAcc.rows[0].balance_minor).toBe("136200");

    // 商家余额：0 + 13800 = 13800
    const merchantAcc = await query<{ balance_minor: string }>(
      `SELECT balance_minor FROM accounts WHERE owner_type='merchant' AND owner_id='A'`,
    );
    expect(merchantAcc.rows[0].balance_minor).toBe("13800");

    // 授权剩余：30000 - 13800 = 16200
    const updatedMandate = await query<{ remaining_minor: string; remaining_purchases: number }>(
      `SELECT remaining_minor, remaining_purchases FROM mandates WHERE id=$1`,
      [mandate.id],
    );
    expect(updatedMandate.rows[0].remaining_minor).toBe("16200");
    expect(updatedMandate.rows[0].remaining_purchases).toBe(1);

    // 库存：25 - 1 = 24
    const product = await query<{ stock_qty: number }>(
      `SELECT stock_qty FROM products WHERE id='A-LD-001'`,
    );
    expect(product.rows[0].stock_qty).toBe(24);

    // SALE journal 合计为 0
    const journal = await query<{ total: string }>(
      `SELECT SUM(amount_minor) AS total FROM ledger_entries
       WHERE journal_id IN (SELECT id FROM journals WHERE order_id=$1)`,
      [settleResult.orderId],
    );
    expect(journal.rows[0].total).toBe("0");
  });

  it("幂等：同一订单同一幂等键重复支付 → 返回相同结果", async () => {
    const mandate = await createMandate(userId, {
      taskText: "测试幂等",
      task: { query: "洗衣液", qty: 1, minSpec: {}, allowSubstituteBrand: true, preferredBrand: null },
      categories: ["household"],
      merchantDeny: [],
      perTxnHKD: "150",
      totalHKD: "300",
      maxPurchases: 2,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      reviewWhen: { nearCapPct: 95, substituteBrand: false, watchCategories: [], newMerchantDays: null, priceAboveRefPct: null },
      protectionLevel: "standard",
      allowedMethods: ["fps"],
    });

    const inputText = "洗衣液";
    const taskId = await createTask(userId, mandate.id, inputText);
    const taskResult = await runTask({
      taskId,
      userId,
      mandateId: mandate.id,
      inputText,
    });

    if (!taskResult.selectedCartId) throw new Error("未创建购物车");

    const idempotencyKey = `test-idempotent-${Date.now()}`;

    // 第一次支付
    const result1 = await settle({
      cartId: taskResult.selectedCartId,
      cartVersion: taskResult.selectedCartVersion!,
      userId,
      idempotencyKey,
      methodId: "fps",
    });

    expect(result1.status).toBe("succeeded");
    const orderId1 = result1.orderId;

    // 第二次支付（相同幂等键）
    const result2 = await settle({
      cartId: taskResult.selectedCartId,
      cartVersion: taskResult.selectedCartVersion!,
      userId,
      idempotencyKey,
      methodId: "fps",
    });

    expect(result2.status).toBe("succeeded");
    expect(result2.orderId).toBe(orderId1);
    expect(result2.transactionId).toBe(result1.transactionId);

    // 只有一个 SALE journal
    const journals = await query(
      `SELECT COUNT(*) AS cnt FROM journals WHERE type='SALE' AND order_id=$1`,
      [orderId1],
    );
    expect(journals.rows[0].cnt).toBe("1");

    // 买家余额只扣一次
    const buyerAcc = await query<{ balance_minor: string }>(
      `SELECT balance_minor FROM accounts WHERE owner_type='buyer' AND owner_id=$1`,
      [userId],
    );
    expect(BigInt(buyerAcc.rows[0].balance_minor)).toBe(150000n - BigInt(result1.totalMinor));
  });
});
