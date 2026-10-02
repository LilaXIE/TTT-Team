// /task/[id] 页面期望的 GET /api/tasks/[id] 响应形状（前端视角）。
// 字段按 docs/MANUAL.md §3.3、§6.1、§7.2 推出；与阶段 2 实际接口对齐后以接口为准，改这里即可。
// 金额一律为分的十进制字符串。
import type { Decision } from "@/contracts/schemas";

export type TaskStatus = "running" | "awaiting_confirmation" | "completed" | "failed" | "cancelled";

export interface AgentStep {
  tool: string;
  summary: string;
  ms: number;
}

export interface CandidateView {
  productId: string;
  name: string;
  brand: string;
  merchantId: string;
  merchantName: string;
  merchantCredentialStatus: "valid" | "revoked" | "expired" | "missing";
  merchantAgeDays: number;
  priceMinor: string;
  shippingMinor: string;
  totalMinor: string;
  deliveryDays: number;
  decision: Decision;
  chosen: boolean;
  explanation?: string;
}

export interface CartVersionView {
  cartId: string;
  version: number;
  merchantName: string;
  items: { name: string; qty: number; unitPriceMinor: string }[];
  subtotalMinor: string;
  shippingMinor: string;
  consumerFeeMinor: string;
  totalMinor: string;
  methodId: string;
  quoteExpiresAt: string;
}

export interface DecisionRecord extends Decision {
  id: string;
  cartId: string | null;
  cartVersion: number | null;
}

export interface OrderView {
  id: string;
  status: "pending" | "paid" | "declined" | "cancelled";
  totalMinor: string;
  methodId: string;
  merchantName: string;
  paidAt: string | null;
  transactionId: string | null;
}

export interface TaskDetail {
  task: { id: string; mandateId: string; mandateVersion: number; status: TaskStatus; inputText: string; createdAt: string };
  run: { mode: "llm" | "fallback"; steps: AgentStep[]; candidates: CandidateView[] } | null;
  cart: CartVersionView | null;
  decisions: DecisionRecord[];
  order: OrderView | null;
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  running: "Agent 执行中",
  awaiting_confirmation: "等你确认",
  completed: "已完成",
  failed: "未能完成",
  cancelled: "已取消",
};

export const METHOD_LABEL: Record<string, string> = { fps: "FPS 转数快", tapngo_mc: "Tap & Go Mastercard" };

export const CHECKPOINT_LABEL: Record<string, string> = {
  INTENT: "理解任务",
  CANDIDATES: "筛选候选",
  QUOTE: "报价与额度",
  ROUTE: "支付方式",
  PAY: "结算",
};

// ---------- GET /api/inbox（/inbox 页面） ----------
// 当前用户 status='awaiting_confirmation' 的任务。过期（30 分钟）后服务端惰性改为 cancelled，不再返回。
export interface InboxItem {
  task: { id: string; mandateId: string; mandateVersion: number; inputText: string; createdAt: string };
  cart: CartVersionView;
  /** 最新一条 REVIEW 决策；确认时提交其 cartId、cartVersion 与全部 REVIEW 规则 id */
  decision: DecisionRecord;
  expiresAt: string;
  /** 服务端算出的剩余秒数；前端以收到响应的时刻为起点倒计时，避免客户端时钟偏差 */
  remainingSeconds: number;
}

export interface InboxResponse {
  items: InboxItem[];
}

/** POST /api/confirmations 请求体；响应为最新的 TaskDetail */
export interface ConfirmationRequest {
  taskId: string;
  cartId: string;
  cartVersion: number;
  ruleIds: string[];
}

// ---------- GET /api/pay-methods/compare?cartId&version（/pay-methods 页面） ----------
// 按 MANUAL §9：先资格后成本；回赠只展示不排序。数组顺序即服务端排序结果，前端按原顺序渲染。
export interface PayMethodOption {
  methodId: string;
  label: string;
  network: string;
  /** 授权允许 ∧ 商家接受 ∧ 用户启用 */
  eligible: boolean;
  /** 不通过的原因（人话）；通过时为空数组 */
  ineligibleReasons: string[];
  /** 消费者手续费；null = 未核实，不能当作 0 */
  consumerFeeMinor: string | null;
  /** 购物车含运费总额 + 消费者手续费；手续费未核实时为 null */
  consumerCostMinor: string | null;
  /** 手续费的适用条件（来源页面摘要） */
  feeConditions: string | null;
  /** 预计回赠；null = 未核实或没有，不计入节省 */
  estRewardMinor: string | null;
  rewardConditions: string | null;
  /** rates.json 原值，如 "instant"、"T+1 (simulated)" */
  settlement: string;
  sourceUrl: string | null;
  observedAt: string;
  /** 只在 eligible 且成本已知的方式中按成本升序排名（从 1 开始）；null = 不参与排序 */
  costRank: number | null;
}

export interface PayMethodsCompare {
  cart: { cartId: string; version: number; merchantName: string; totalMinor: string; methodId: string };
  methods: PayMethodOption[];
}

// ---------- GET /api/ledger（/ledger 页面） ----------
// 按任务分组，新任务在前。全部来自数据库记录（decisions、payment_attempts、orders、journals），不现场重算。
export interface LedgerDecision extends DecisionRecord {
  /** 判定当时的快照 */
  snapshot: {
    remainingMinor: string;
    remainingPurchases: number;
    /** 实际扣款总额（商品 + 运费 + 消费者手续费）；还没有购物车时为 null */
    totalMinor: string | null;
    methodId: string | null;
  };
}

export interface LedgerAttempt {
  id: string;
  orderId: string;
  status: "pending" | "settled" | "declined";
  /** declined 时的错误码，如 ISSUER_DECLINED、CAP_TOTAL、RISK_CONFIRMATION_REQUIRED */
  reasonCode: string | null;
  reason: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  type: "refund" | "return";
  reason: string;
  status: "manual_review";
  createdAt: string;
}

export interface LedgerReceipt {
  orderId: string;
  orderStatus: OrderView["status"];
  transactionId: string | null;
  merchantName: string;
  items: { name: string; qty: number; unitPriceMinor: string }[];
  subtotalMinor: string;
  shippingMinor: string;
  consumerFeeMinor: string;
  totalMinor: string;
  methodId: string;
  paidAt: string | null;
  /** SALE journal 的分录，合计为 0 */
  entries: { account: string; amountMinor: string }[];
  support: SupportTicket | null;
}

export interface LedgerGroup {
  task: { id: string; inputText: string; status: TaskStatus; createdAt: string };
  /** 任务执行时的授权版本与上限 */
  mandate: { id: string; version: number; perTxnMinor: string; totalMinor: string; maxPurchases: number; expiresAt: string };
  runMode: "llm" | "fallback" | null;
  candidates: { productId: string; name: string; merchantName: string; totalMinor: string; outcome: Decision["outcome"]; chosen: boolean }[];
  decisions: LedgerDecision[];
  attempts: LedgerAttempt[];
  receipt: LedgerReceipt | null;
}

export interface LedgerResponse {
  groups: LedgerGroup[];
}

/** POST /api/orders/[id]/support 请求体；响应为 SupportTicket（重复提交返回同一工单） */
export interface SupportRequest {
  type: SupportTicket["type"];
  reason: string;
}

export const SETTLEMENT_LABEL: Record<string, string> = {
  instant: "即时到账",
  "T+1 (simulated)": "T+1（模拟设定，不是官方结算承诺）",
};
