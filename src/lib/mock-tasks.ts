// /task/mock-s1|mock-s2|mock-s3 的示例数据，供阶段 2 接口就绪前做页面。接口接通后删除本文件。
// 数字来自 fixtures/catalog.json 与 docs/MANUAL.md §10。
// 三个任务依次在同一份授权书的 v1、v2、v3 下执行（修改授权 = 新版本）。
import type { Decision, RuleHit } from "@/contracts/schemas";
import type { CandidateView, InboxResponse, LedgerDecision, LedgerGroup, LedgerResponse, PayMethodsCompare, TaskDetail } from "./task-view";

const T0 = "2026-10-03T09:00:00+08:00";
const T2 = "2026-10-03T09:10:00+08:00";
const T3 = "2026-10-03T09:20:00+08:00";

function d(outcome: Decision["outcome"], checkpoint: Decision["checkpoint"], rules: RuleHit[] = [], mandateVersion = 1, evaluatedAt = T0): Decision {
  return { outcome, checkpoint, rules, mandateVersion, evaluatedAt };
}
const d2 = (outcome: Decision["outcome"], checkpoint: Decision["checkpoint"], rules: RuleHit[] = []) => d(outcome, checkpoint, rules, 2, T2);
const d3 = (outcome: Decision["outcome"], checkpoint: Decision["checkpoint"], rules: RuleHit[] = []) => d(outcome, checkpoint, rules, 3, T3);

const capPerTxn = (total: string, cap: string): RuleHit => ({
  id: "CAP_PER_TXN",
  severity: "DENY",
  message: `这笔含运费 ${total}，超过你设的单笔上限 ${cap}。`,
});

const A_LD_001: Omit<CandidateView, "decision" | "chosen"> = {
  productId: "A-LD-001",
  name: "品牌甲 浓缩洗衣液 2L",
  brand: "品牌甲",
  merchantId: "A",
  merchantName: "日日鲜百货",
  merchantCredentialStatus: "valid",
  merchantAgeDays: 1114,
  priceMinor: "11800",
  shippingMinor: "2000",
  totalMinor: "13800",
  deliveryDays: 3,
};
const A_LD_002: Omit<CandidateView, "decision" | "chosen"> = {
  productId: "A-LD-002",
  name: "品牌乙 除菌洗衣液 3L",
  brand: "品牌乙",
  merchantId: "A",
  merchantName: "日日鲜百货",
  merchantCredentialStatus: "valid",
  merchantAgeDays: 1114,
  priceMinor: "13900",
  shippingMinor: "2000",
  totalMinor: "15900",
  deliveryDays: 3,
};
const B_LD_003: Omit<CandidateView, "decision" | "chosen"> = {
  productId: "B-LD-003",
  name: "品牌丙 植萃洗衣液 2.5L",
  brand: "品牌丙",
  merchantId: "B",
  merchantName: "快快屋",
  merchantCredentialStatus: "valid",
  merchantAgeDays: 26,
  priceMinor: "12800",
  shippingMinor: "3000",
  totalMinor: "15800",
  deliveryDays: 1,
};

const STEPS_SEARCH = [
  { tool: "extract_intent", summary: "关键词「洗衣液」×1，规格 volumeMl ≥ 2000，预算 HK$150", ms: 4 },
  { tool: "engine_decide", summary: "INTENT：ALLOW（household 在授权品类内）", ms: 1 },
  { tool: "search_catalog", summary: "在 2 个可购买商家中找到 4 件洗衣液", ms: 38 },
  { tool: "engine_decide", summary: "CANDIDATES：1 件规格不足被移除，保留 3 件", ms: 2 },
  { tool: "quote", summary: "为 3 个候选报价（含运费）", ms: 21 },
];

const s1: TaskDetail = {
  task: { id: "mock-s1", mandateId: "mock-mandate", mandateVersion: 1, status: "completed", inputText: "帮我补一瓶洗衣液，2L 以上，HK$150 以内，可以换牌子，这周内买到。", createdAt: T0 },
  run: {
    mode: "fallback",
    steps: [
      ...STEPS_SEARCH,
      { tool: "rank", summary: "按含运费总额升序：日日鲜百货 品牌甲 2L HK$138.00 排第一", ms: 1 },
      { tool: "create_cart_version", summary: "购物车 v1：品牌甲 2L ×1，FPS，含运费 HK$138.00", ms: 12 },
      { tool: "engine_decide", summary: "QUOTE + ROUTE：ALLOW", ms: 1 },
      { tool: "settle", summary: "结算成功：扣款 HK$138.00，授权剩余 HK$162.00、1 次", ms: 64 },
    ],
    candidates: [
      { ...A_LD_001, chosen: true, decision: d("ALLOW", "CANDIDATES"), explanation: "同品牌、规格刚好 2L，含运费 HK$138.00 在单笔上限内，商家注册 3 年。" },
      { ...A_LD_002, chosen: false, decision: d("DENY", "CANDIDATES", [capPerTxn("HK$159.00", "HK$150.00")]) },
      { ...B_LD_003, chosen: false, decision: d("DENY", "CANDIDATES", [capPerTxn("HK$158.00", "HK$150.00")]) },
    ],
  },
  cart: {
    cartId: "mock-cart-1",
    version: 1,
    merchantName: "日日鲜百货",
    items: [{ name: "品牌甲 浓缩洗衣液 2L", qty: 1, unitPriceMinor: "11800" }],
    subtotalMinor: "11800",
    shippingMinor: "2000",
    consumerFeeMinor: "0",
    totalMinor: "13800",
    methodId: "fps",
    quoteExpiresAt: "2026-10-03T09:05:00+08:00",
  },
  decisions: [
    { ...d("ALLOW", "INTENT"), id: "1", cartId: null, cartVersion: null },
    { ...d("ALLOW", "QUOTE"), id: "2", cartId: "mock-cart-1", cartVersion: 1 },
    { ...d("ALLOW", "ROUTE"), id: "3", cartId: "mock-cart-1", cartVersion: 1 },
    { ...d("ALLOW", "PAY"), id: "4", cartId: "mock-cart-1", cartVersion: 1 },
  ],
  order: { id: "mock-order-1", status: "paid", totalMinor: "13800", methodId: "fps", merchantName: "日日鲜百货", paidAt: "2026-10-03T09:00:02+08:00", transactionId: "mock-txn-1" },
};

const substitute: RuleHit = {
  id: "SUBSTITUTE_BRAND",
  severity: "REVIEW",
  message: "候选是「品牌丙」，和你常买的「品牌甲」不是同一个牌子。",
};

const s2: TaskDetail = {
  task: { id: "mock-s2", mandateId: "mock-mandate", mandateVersion: 2, status: "awaiting_confirmation", inputText: "帮我补一瓶洗衣液，2.5L 以上，HK$200 以内，可以换牌子。", createdAt: T2 },
  run: {
    mode: "fallback",
    steps: [
      ...STEPS_SEARCH,
      { tool: "rank", summary: "满足 2.5L 的候选中，快快屋 品牌丙 2.5L 含运费最低", ms: 1 },
      { tool: "create_cart_version", summary: "购物车 v1：品牌丙 2.5L ×1，FPS，含运费 HK$158.00", ms: 11 },
      { tool: "engine_decide", summary: "QUOTE + ROUTE：REVIEW（换了品牌）→ 暂停等你确认", ms: 1 },
    ],
    candidates: [
      { ...B_LD_003, chosen: true, decision: d2("REVIEW", "CANDIDATES", [substitute]), explanation: "满足 2.5L 的选项里含运费最低，次日送达；但不是你常买的品牌甲。" },
      { ...A_LD_002, chosen: false, decision: d2("REVIEW", "CANDIDATES", [{ ...substitute, message: "候选是「品牌乙」，和你常买的「品牌甲」不是同一个牌子。" }]) },
    ],
  },
  cart: {
    cartId: "mock-cart-2",
    version: 1,
    merchantName: "快快屋",
    items: [{ name: "品牌丙 植萃洗衣液 2.5L", qty: 1, unitPriceMinor: "12800" }],
    subtotalMinor: "12800",
    shippingMinor: "3000",
    consumerFeeMinor: "0",
    totalMinor: "15800",
    methodId: "fps",
    quoteExpiresAt: "2026-10-03T09:15:00+08:00",
  },
  decisions: [
    { ...d2("ALLOW", "INTENT"), id: "1", cartId: null, cartVersion: null },
    { ...d2("REVIEW", "QUOTE", [substitute]), id: "2", cartId: "mock-cart-2", cartVersion: 1 },
  ],
  order: null,
};

const s3: TaskDetail = {
  task: { id: "mock-s3", mandateId: "mock-mandate", mandateVersion: 3, status: "failed", inputText: "帮我补一瓶洗衣液，2L 以上，HK$100 以内。", createdAt: T3 },
  run: {
    mode: "fallback",
    steps: [
      ...STEPS_SEARCH,
      { tool: "rank", summary: "全部候选含运费都超过单笔上限 HK$100.00", ms: 1 },
      { tool: "engine_decide", summary: "QUOTE：DENY（CAP_PER_TXN），没有可切换的次选", ms: 1 },
    ],
    candidates: [
      { ...A_LD_001, chosen: true, decision: d3("DENY", "CANDIDATES", [capPerTxn("HK$138.00", "HK$100.00")]) },
      { ...B_LD_003, chosen: false, decision: d3("DENY", "CANDIDATES", [capPerTxn("HK$158.00", "HK$100.00")]) },
    ],
  },
  cart: null,
  decisions: [
    { ...d3("ALLOW", "INTENT"), id: "1", cartId: null, cartVersion: null },
    { ...d3("DENY", "QUOTE", [capPerTxn("HK$138.00", "HK$100.00")]), id: "2", cartId: null, cartVersion: null },
  ],
  order: null,
};

export const MOCK_TASKS: Record<string, TaskDetail> = { "mock-s1": s1, "mock-s2": s2, "mock-s3": s3 };

/** /inbox：mock-s2 等你确认。remainingSeconds 以页面加载时刻为起点倒计时。 */
export const MOCK_INBOX: InboxResponse = {
  items: [
    {
      task: { id: s2.task.id, mandateId: s2.task.mandateId, mandateVersion: s2.task.mandateVersion, inputText: s2.task.inputText, createdAt: s2.task.createdAt },
      cart: s2.cart!,
      decision: s2.decisions.at(-1)!,
      expiresAt: "2026-10-03T09:40:00+08:00",
      remainingSeconds: 25 * 60,
    },
  ],
};
// 费率口径来自戚译匀核实的 fixtures/rates.json（Hackathon 工作目录，尚未合入仓库）。
const RATES_OBSERVED_AT = "2026-10-03T01:18:49+08:00";

/** /pay-methods：按 cartId 找 mock 购物车，找不到用 mock-s1 的。 */
export function mockPayMethods(cartId?: string): PayMethodsCompare {
  const cart = Object.values(MOCK_TASKS).find((t) => t.cart?.cartId === cartId)?.cart ?? s1.cart!;
  return {
    cart: { cartId: cart.cartId, version: cart.version, merchantName: cart.merchantName, totalMinor: cart.totalMinor, methodId: cart.methodId },
    methods: [
      {
        methodId: "fps",
        label: "FPS 转数快",
        network: "FPS",
        eligible: true,
        ineligibleReasons: [],
        consumerFeeMinor: "0",
        consumerCostMinor: (BigInt(cart.totalMinor) + 0n).toString(),
        feeConditions: "手续费 0 仅限 HSBC 个人客户经其 App 或网上理财做本地港元付款；其他银行或储值支付工具可能收费。",
        estRewardMinor: null,
        rewardConditions: null,
        settlement: "instant",
        sourceUrl: "https://www.hsbc.com.hk/zh-hk/help/faq/transfers-and-payments/",
        observedAt: RATES_OBSERVED_AT,
        costRank: 1,
      },
      {
        methodId: "tapngo_mc",
        label: "Tap & Go Mastercard",
        network: "Mastercard",
        eligible: true,
        ineligibleReasons: [],
        consumerFeeMinor: null,
        consumerCostMinor: null,
        feeConditions: "收费表未明确列出香港本地港元消费免费；年费或增值免费不等于消费手续费为 0。",
        estRewardMinor: null,
        rewardConditions: null,
        settlement: "T+1 (simulated)",
        sourceUrl: "https://www.tapngo.com.hk/eng/charges.html",
        observedAt: RATES_OBSERVED_AT,
        costRank: null,
      },
    ],
  };
}
// ---------- /ledger：把 S1（v1 已付）→ S2（v2 等确认）→ S3（v3 拒绝）串成一条记录 ----------
const MOCK_EXPIRES = "2026-10-09T23:59:59+08:00";

function withSnapshot(t: TaskDetail, snaps: LedgerDecision["snapshot"][]): LedgerDecision[] {
  return t.decisions.map((dd, i) => ({ ...dd, snapshot: snaps[i] }));
}

function groupOf(t: TaskDetail, perTxnMinor: string, snaps: LedgerDecision["snapshot"][], rest: Pick<LedgerGroup, "attempts" | "receipt">): LedgerGroup {
  return {
    task: { id: t.task.id, inputText: t.task.inputText, status: t.task.status, createdAt: t.task.createdAt },
    mandate: { id: t.task.mandateId, version: t.task.mandateVersion, perTxnMinor, totalMinor: "30000", maxPurchases: 2, expiresAt: MOCK_EXPIRES },
    runMode: t.run?.mode ?? null,
    candidates: (t.run?.candidates ?? []).map((c) => ({
      productId: c.productId,
      name: c.name,
      merchantName: c.merchantName,
      totalMinor: c.totalMinor,
      outcome: c.decision.outcome,
      chosen: c.chosen,
    })),
    decisions: withSnapshot(t, snaps),
    ...rest,
  };
}

const beforeS1 = { remainingMinor: "30000", remainingPurchases: 2 };
const afterS1 = { remainingMinor: "16200", remainingPurchases: 1 };

export const MOCK_LEDGER: LedgerResponse = {
  groups: [
    groupOf(
      s3,
      "10000",
      [
        { ...afterS1, totalMinor: null, methodId: null },
        { ...afterS1, totalMinor: "13800", methodId: null },
      ],
      { attempts: [], receipt: null },
    ),
    groupOf(
      s2,
      "20000",
      [
        { ...afterS1, totalMinor: null, methodId: null },
        { ...afterS1, totalMinor: "15800", methodId: "fps" },
      ],
      { attempts: [], receipt: null },
    ),
    groupOf(
      s1,
      "15000",
      [
        { ...beforeS1, totalMinor: null, methodId: null },
        { ...beforeS1, totalMinor: "13800", methodId: "fps" },
        { ...beforeS1, totalMinor: "13800", methodId: "fps" },
        { ...beforeS1, totalMinor: "13800", methodId: "fps" },
      ],
      {
        attempts: [{ id: "mock-attempt-1", orderId: "mock-order-1", status: "settled", reasonCode: null, reason: null, createdAt: "2026-10-03T09:00:02+08:00" }],
        receipt: {
          orderId: "mock-order-1",
          orderStatus: "paid",
          transactionId: "mock-txn-1",
          merchantName: "日日鲜百货",
          items: [{ name: "品牌甲 浓缩洗衣液 2L", qty: 1, unitPriceMinor: "11800" }],
          subtotalMinor: "11800",
          shippingMinor: "2000",
          consumerFeeMinor: "0",
          totalMinor: "13800",
          methodId: "fps",
          paidAt: "2026-10-03T09:00:02+08:00",
          entries: [
            { account: "买家钱包 Alex", amountMinor: "-13800" },
            { account: "商家 日日鲜百货", amountMinor: "13800" },
          ],
          support: null,
        },
      },
    ),
  ],
};