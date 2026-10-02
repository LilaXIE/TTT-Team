// /task/mock-s1|mock-s2|mock-s3 的示例数据，供阶段 2 接口就绪前做页面。接口接通后删除本文件。
// 数字来自 fixtures/catalog.json 与 docs/MANUAL.md §10。
import type { Decision, RuleHit } from "@/contracts/schemas";
import type { CandidateView, TaskDetail } from "./task-view";

const T0 = "2026-10-03T09:00:00+08:00";

function d(outcome: Decision["outcome"], checkpoint: Decision["checkpoint"], rules: RuleHit[] = []): Decision {
  return { outcome, checkpoint, rules, mandateVersion: 1, evaluatedAt: T0 };
}

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
  task: { id: "mock-s2", mandateId: "mock-mandate", mandateVersion: 1, status: "awaiting_confirmation", inputText: "帮我补一瓶洗衣液，2.5L 以上，HK$200 以内，可以换牌子。", createdAt: T0 },
  run: {
    mode: "fallback",
    steps: [
      ...STEPS_SEARCH,
      { tool: "rank", summary: "满足 2.5L 的候选中，快快屋 品牌丙 2.5L 含运费最低", ms: 1 },
      { tool: "create_cart_version", summary: "购物车 v1：品牌丙 2.5L ×1，FPS，含运费 HK$158.00", ms: 11 },
      { tool: "engine_decide", summary: "QUOTE + ROUTE：REVIEW（换了品牌）→ 暂停等你确认", ms: 1 },
    ],
    candidates: [
      { ...B_LD_003, chosen: true, decision: d("REVIEW", "CANDIDATES", [substitute]), explanation: "满足 2.5L 的选项里含运费最低，次日送达；但不是你常买的品牌甲。" },
      { ...A_LD_002, chosen: false, decision: d("REVIEW", "CANDIDATES", [{ ...substitute, message: "候选是「品牌乙」，和你常买的「品牌甲」不是同一个牌子。" }]) },
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
    quoteExpiresAt: "2026-10-03T09:05:00+08:00",
  },
  decisions: [
    { ...d("ALLOW", "INTENT"), id: "1", cartId: null, cartVersion: null },
    { ...d("REVIEW", "QUOTE", [substitute]), id: "2", cartId: "mock-cart-2", cartVersion: 1 },
  ],
  order: null,
};

const s3: TaskDetail = {
  task: { id: "mock-s3", mandateId: "mock-mandate", mandateVersion: 1, status: "failed", inputText: "帮我补一瓶洗衣液，2L 以上，HK$100 以内。", createdAt: T0 },
  run: {
    mode: "fallback",
    steps: [
      ...STEPS_SEARCH,
      { tool: "rank", summary: "全部候选含运费都超过单笔上限 HK$100.00", ms: 1 },
      { tool: "engine_decide", summary: "QUOTE：DENY（CAP_PER_TXN），没有可切换的次选", ms: 1 },
    ],
    candidates: [
      { ...A_LD_001, chosen: true, decision: d("DENY", "CANDIDATES", [capPerTxn("HK$138.00", "HK$100.00")]) },
      { ...B_LD_003, chosen: false, decision: d("DENY", "CANDIDATES", [capPerTxn("HK$158.00", "HK$100.00")]) },
    ],
  },
  cart: null,
  decisions: [
    { ...d("ALLOW", "INTENT"), id: "1", cartId: null, cartVersion: null },
    { ...d("DENY", "QUOTE", [capPerTxn("HK$138.00", "HK$100.00")]), id: "2", cartId: null, cartVersion: null },
  ],
  order: null,
};

export const MOCK_TASKS: Record<string, TaskDetail> = { "mock-s1": s1, "mock-s2": s2, "mock-s3": s3 };
