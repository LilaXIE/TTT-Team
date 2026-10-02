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
