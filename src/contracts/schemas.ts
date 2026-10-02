import { z } from "zod";
import type { RuleId } from "./rules";

// ---------- 通用 ----------
/** 十进制整数字符串形式的分 */
export const MinorString = z.string().regex(/^-?\d+$/, "amount must be integer minor units as string");
export const Outcome = z.enum(["ALLOW", "REVIEW", "DENY"]);
export type Outcome = z.infer<typeof Outcome>;
export const Checkpoint = z.enum(["INTENT", "CANDIDATES", "QUOTE", "ROUTE", "PAY"]);
export type Checkpoint = z.infer<typeof Checkpoint>;

export const CredentialStatus = z.enum(["valid", "revoked", "expired", "missing"]);
export type CredentialStatus = z.infer<typeof CredentialStatus>;

export const MandateStatus = z.enum(["active", "revoked", "expired", "completed"]);
export type MandateStatus = z.infer<typeof MandateStatus>;

// ---------- 授权�?----------
/** 表单草稿（前�?�?preview / create）。金额为港元字符串，服务端转分�?*/
export const MandateDraft = z.object({
  taskText: z.string().min(2).max(200),
  task: z.object({
    query: z.string().min(1).max(60),
    qty: z.number().int().min(1).max(20).default(1),
    minSpec: z.record(z.string(), z.number()).default({}),
    allowSubstituteBrand: z.boolean().default(true),
    preferredBrand: z.string().max(40).nullable().default(null),
  }),
  categories: z.array(z.string().min(1)).min(1).max(10),
  merchantDeny: z.array(z.string()).default([]),
  perTxnHKD: z.string().regex(/^\d+(\.\d{1,2})?$/),
  totalHKD: z.string().regex(/^\d+(\.\d{1,2})?$/),
  maxPurchases: z.number().int().min(1).max(20),
  expiresAt: z.string().datetime({ offset: true }),
  reviewWhen: z.object({
    nearCapPct: z.number().int().min(50).max(100).nullable().default(95),
    substituteBrand: z.boolean().default(true),
    watchCategories: z.array(z.string()).default(["supplement"]),
    newMerchantDays: z.number().int().min(1).max(365).nullable().default(null),
    priceAboveRefPct: z.number().int().min(1).max(200).nullable().default(null),
  }),
  protectionLevel: z.enum(["standard", "enhanced"]).default("standard"),
  allowedMethods: z.array(z.string()).min(1),
});
export type MandateDraft = z.infer<typeof MandateDraft>;

/** 编译后的授权�?JSON（存库）。金额为分字符串�?*/
export const MandateJson = z.object({
  task: MandateDraft.shape.task,
  scope: z.object({ categories: z.array(z.string()), merchantDeny: z.array(z.string()) }),
  caps: z.object({ perTxnMinor: MinorString, totalMinor: MinorString, maxPurchases: z.number().int() }),
  reviewWhen: MandateDraft.shape.reviewWhen,
  protectionLevel: z.enum(["standard", "enhanced"]),
  allowedMethods: z.array(z.string()),
  expiresAt: z.string(),
});
export type MandateJson = z.infer<typeof MandateJson>;

// ---------- 商品 / 商家 / 支付方式（fixtures �?API�?----------
export const Merchant = z.object({
  id: z.string(),
  name: z.string(),
  registeredAt: z.string(),
  shippingFeeMinor: MinorString,
  freeShippingOverMinor: MinorString.nullable(),
  deliveryDays: z.number().int(),
  returnDays: z.number().int(),
  acceptsMethods: z.array(z.string()),
  credentialStatus: CredentialStatus,
});
export type Merchant = z.infer<typeof Merchant>;

export const Product = z.object({
  id: z.string(),
  merchantId: z.string(),
  sku: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  spec: z.record(z.string(), z.number()).default({}),
  description: z.string().default(""),
  priceMinor: MinorString,
  refPriceMinor: MinorString,
  stockQty: z.number().int().min(0),
  status: z.enum(["published", "draft", "suspended"]).default("published"),
  riskTags: z.array(z.string()).default([]),
  imageUrl: z.string().nullable().default(null),
});
export type Product = z.infer<typeof Product>;

export const PaymentMethod = z.object({
  id: z.string(),
  label: z.string(),
  network: z.string(),
  consumerFeeMinor: MinorString,
  settlement: z.string(),
  rewards: z
    .object({
      type: z.enum(["cashback_pct", "points"]),
      value: z.number(),
      capMinorPerMonth: MinorString.nullable().default(null),
      conditions: z.string(),
      sourceUrl: z.string().nullable(),
    })
    .nullable(),
  sourceUrl: z.string().nullable(),
  notes: z.string().default(""),
});
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const CatalogFixture = z.object({ merchants: z.array(Merchant), products: z.array(Product) });
export const RatesFixture = z.object({ observedAt: z.string(), methods: z.array(PaymentMethod) });

/** 授权预览用的固定示例 */
export const PreviewScenario = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  merchant: Merchant,
  product: Product,
  qty: z.number().int().min(1),
  shippingMinor: MinorString,
  methodId: z.string(),
});
export type PreviewScenario = z.infer<typeof PreviewScenario>;
export const ScenariosFixture = z.object({ scenarios: z.array(PreviewScenario).length(3) });

// ---------- 购物�?----------
export const CartItem = z.object({
  productId: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  qty: z.number().int().min(1),
  unitPriceMinor: MinorString,
  spec: z.record(z.string(), z.number()).default({}),
  riskTags: z.array(z.string()).default([]),
  refPriceMinor: MinorString,
});
export type CartItem = z.infer<typeof CartItem>;

export const CartSnapshot = z.object({
  cartId: z.string(),
  version: z.number().int(),
  merchantId: z.string(),
  items: z.array(CartItem).min(1),
  subtotalMinor: MinorString,
  shippingMinor: MinorString,
  consumerFeeMinor: MinorString,
  totalMinor: MinorString,
  methodId: z.string(),
  quoteExpiresAt: z.string(),
  hash: z.string(),
});
export type CartSnapshot = z.infer<typeof CartSnapshot>;

// ---------- 决策 ----------
export interface RuleHit {
  id: RuleId;
  severity: "DENY" | "REVIEW";
  message: string;
  data?: Record<string, string | number | boolean | null>;
}
export interface Decision {
  outcome: Outcome;
  checkpoint: Checkpoint;
  rules: RuleHit[];
  mandateVersion: number;
  evaluatedAt: string;
}

// ---------- 引擎输入（服务端构造，纯数据） ----------
export interface MandateSnapshot {
  id: string;
  version: number;
  status: MandateStatus;
  expiresAt: Date;
  revokedAt: Date | null;
  task: MandateJson["task"];
  scope: MandateJson["scope"];
  caps: { perTxnMinor: bigint; totalMinor: bigint; maxPurchases: number };
  reviewWhen: MandateJson["reviewWhen"];
  allowedMethods: string[];
  remainingMinor: bigint;
  remainingPurchases: number;
}

export interface EngineProduct {
  id: string;
  category: string;
  brand: string;
  spec: Record<string, number>;
  priceMinor: bigint;
  refPriceMinor: bigint;
  riskTags: string[];
}

export interface EngineCart {
  version: number;
  items: Array<EngineProduct & { qty: number }>;
  subtotalMinor: bigint;
  shippingMinor: bigint;
  consumerFeeMinor: bigint;
  totalMinor: bigint;
  quoteExpiresAt: Date;
}

export interface EngineContext {
  now: Date;
  mandate: MandateSnapshot;
  buyerCredential: { status: CredentialStatus };
  taskCategory?: string;
  merchant?: { id: string; name: string; credentialStatus: CredentialStatus; registeredAt: Date };
  product?: EngineProduct;
  cart?: EngineCart;
  paymentMethod?: { id: string; label: string; merchantAccepts: boolean; userEnabled: boolean };
}

export interface ConfirmationRecord {
  cartVersion: number;
  ruleIds: string[];
  expiresAt: Date;
}
