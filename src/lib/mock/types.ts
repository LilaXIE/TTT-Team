// 原型阶段的模拟数据类型。金额一律为「分」的十进制字符串，计算时转 bigint。
// 接真实接口时，这些类型对应 docs/MANUAL.md §3.3 的表与 §7.2 的接口返回。
import type { Outcome, RuleId } from "@/contracts";

export type Tx = { zh: string; en: string };
export type Minor = string;
export type MethodId = "fps" | "tapngo_mc";
export type Category = "household" | "supplement" | "drinkware" | "alcohol" | "electronics";
export type Delivery = "today" | "tomorrow" | "week";

export interface MockMerchant {
  id: string;
  name: Tx;
  registeredAt: string;
  credential: "valid" | "revoked";
  shippingMinor: Minor;
  freeOverMinor: Minor | null;
  delivery: Delivery;
  deliveryDays: number;
  returnDays: number;
  accepts: MethodId[];
}

export interface MockProduct {
  id: string;
  merchantId: string;
  name: Tx;
  brand: Tx;
  category: Category;
  spec: Record<string, number>;
  specLabel: Tx;
  priceMinor: Minor;
  refPriceMinor: Minor;
  /** 评分 × 10，例如 47 = 4.7 */
  rating10: number;
  sales: number;
  riskTags: string[];
  /** 商家写的描述。它是数据，永远不进入 Agent 的指令 */
  description: Tx;
  injected?: boolean;
  /** 原型里的商品图用色块代替 */
  tone: string;
  styleTags?: string[];
}

export interface ReviewWhen {
  nearCapPct: number | null;
  substituteBrand: boolean;
  watchCategories: string[];
  newMerchantDays: number | null;
  priceAboveRefPct: number | null;
}

export interface MandateVersion {
  v: number;
  at: string;
  note: Tx;
}

export interface MockMandate {
  id: string;
  title: Tx;
  version: number;
  status: "active" | "revoked" | "completed" | "expired";
  mode: "quick" | "curated";
  queryKind: QueryKind;
  taskText: string;
  query: Tx;
  preferredBrand: string | null;
  allowSubstituteBrand: boolean;
  minVolumeMl: number | null;
  categories: Category[];
  perTxnMinor: Minor;
  totalMinor: Minor;
  remainingMinor: Minor;
  maxPurchases: number;
  remainingPurchases: number;
  expiresAt: string;
  reviewWhen: ReviewWhen;
  protection: "standard" | "enhanced";
  methods: MethodId[];
  createdAt: string;
  revokedAt: string | null;
  versions: MandateVersion[];
}

export interface RuleRef {
  id: RuleId;
  severity: "DENY" | "REVIEW";
}

export interface MockOrder {
  id: string;
  taskId: string;
  mandateId: string;
  mandateVersion: number;
  productId: string;
  merchantId: string;
  qty: number;
  subtotalMinor: Minor;
  shippingMinor: Minor;
  feeMinor: Minor;
  totalMinor: Minor;
  method: MethodId;
  status: "paid" | "declined";
  paidAt: string;
  cartVersion: number;
  idempotencyKey: string;
  confirmedRules: RuleId[];
  support: "none" | "manual_review";
  /** 用户提交售后时写的原因，只用于展示 */
  supportNote?: string;
  /** 被过滤或未选中的候选，用于记录页追溯 */
  candidates: { productId: string; outcome: Outcome; rules: RuleRef[] }[];
}

export interface PendingConfirmation {
  id: string;
  taskId: string;
  mandateId: string;
  productId: string;
  cartVersion: number;
  totalMinor: Minor;
  rules: RuleRef[];
  createdAt: string;
  expiresAt: string;
  status: "pending" | "confirmed" | "cancelled" | "expired" | "invalidated";
}

/** 放宽权限的变更要冷静期：提高上限、改地址 */
export interface CoolingChange {
  id: string;
  kind: "raise_cap" | "address";
  mandateId?: string;
  fromMinor?: Minor;
  toMinor?: Minor;
  address?: string;
  requestedAt: string;
  effectiveAt: string;
  status: "waiting" | "cancelled" | "applied";
  byAttacker?: boolean;
}

export interface Device {
  id: string;
  name: Tx;
  place: Tx;
  lastSeen: string;
  current?: boolean;
  passkey: boolean;
  readOnly: boolean;
  isNew?: boolean;
}

export interface PrefTag {
  id: string;
  group: "style" | "color" | "price" | "brand" | "material";
  label: Tx;
  source: "chat" | "favorites" | "orders";
}

export interface ActivityEvent {
  id: string;
  at: string;
  kind: "login" | "step_up" | "step_up_failed" | "freeze" | "revoke" | "cooling" | "notice" | "consent";
  text: Tx;
  risky?: boolean;
}

// ---------- 任务对话 ----------

export interface DraftFields {
  title: Tx;
  mode: "quick" | "curated";
  queryKind: QueryKind;
  query: Tx;
  categories: Category[];
  perTxnMinor: Minor;
  totalMinor: Minor;
  maxPurchases: number;
  days: number;
  preferredBrand: string | null;
  allowSubstituteBrand: boolean;
  minVolumeMl: number | null;
  reviewWhen: ReviewWhen;
  protection: "standard" | "enhanced";
  methods: MethodId[];
}

export type Block =
  | { kind: "user"; text: string | Tx; at: string }
  | { kind: "zev"; text: Tx; at: string }
  | { kind: "draft"; fields: DraftFields; signedMandateId: string | null; at: string }
  | { kind: "in_scope"; mandateId: string; at: string }
  | { kind: "working"; mandateId: string; at: string }
  | {
      kind: "pick";
      round: number;
      productId: string;
      mandateId: string;
      state: "offered" | "paid" | "awaiting" | "denied" | "skipped" | "declined";
      at: string;
      reason: Tx;
      /** 范围内（ALLOW）倒计时自动付款的时间点；用户展开其他选项或筛选时暂停为 null */
      autoPayAt?: string | null;
      chosenByUser?: boolean;
    }
  | { kind: "receipt"; orderId: string; at: string }
  | { kind: "awaiting"; pendingId: string; at: string }
  | { kind: "denied"; productId: string; mandateId: string; rules: RuleRef[]; at: string }
  | { kind: "hint"; at: string }
  | { kind: "curated"; mandateId: string; query: QueryKind; at: string }
  | { kind: "shortlist"; mandateId: string; productIds: string[]; at: string };

export type QueryKind = "detergent" | "tissue" | "tumbler";

export interface TimelineStep {
  checkpoint: "INTENT" | "SEARCH" | "CANDIDATES" | "QUOTE" | "ROUTE" | "PAY";
  title: Tx;
  detail: Tx;
  outcome?: Outcome;
  at: string;
}

export interface MockTask {
  id: string;
  title: Tx;
  status: "running" | "awaiting_confirmation" | "completed" | "failed" | "drafting";
  mode: "quick" | "curated";
  mandateId: string | null;
  createdAt: string;
  agentMode: "llm" | "fallback";
  blocks: Block[];
  timeline: TimelineStep[];
}
