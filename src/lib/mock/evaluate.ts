// 原型里的判定直接调用真实的纯函数引擎 decideCandidate()，不在界面里另写一套规则。
// 结算时仍由服务端 settle() 自己构造上下文并调用 decide(ctx, "PAY")，界面结果只用于展示。
import type { EngineContext, MandateSnapshot, Outcome } from "@/contracts";
import { decideCandidate } from "@/server/rules/engine";
import { merchantOf, PRODUCTS, productOf, quoteOf } from "./catalog";
import type { DraftFields, MethodId, MockMandate, MockProduct, RuleRef } from "./types";

export interface Evaluation {
  outcome: Outcome;
  rules: RuleRef[];
  subtotal: bigint;
  shipping: bigint;
  fee: bigint;
  total: bigint;
}

type MandateLike = Pick<
  MockMandate,
  | "id"
  | "version"
  | "status"
  | "expiresAt"
  | "revokedAt"
  | "categories"
  | "perTxnMinor"
  | "totalMinor"
  | "remainingMinor"
  | "maxPurchases"
  | "remainingPurchases"
  | "reviewWhen"
  | "methods"
  | "preferredBrand"
  | "allowSubstituteBrand"
  | "minVolumeMl"
>;

export function snapshotOf(m: MandateLike): MandateSnapshot {
  return {
    id: m.id,
    version: m.version,
    status: m.status,
    expiresAt: new Date(m.expiresAt),
    revokedAt: m.revokedAt ? new Date(m.revokedAt) : null,
    task: {
      query: "",
      qty: 1,
      minSpec: m.minVolumeMl ? { volumeMl: m.minVolumeMl } : {},
      allowSubstituteBrand: m.allowSubstituteBrand,
      preferredBrand: m.preferredBrand,
    },
    scope: { categories: [...m.categories], merchantDeny: [] },
    caps: { perTxnMinor: BigInt(m.perTxnMinor), totalMinor: BigInt(m.totalMinor), maxPurchases: m.maxPurchases },
    reviewWhen: { ...m.reviewWhen },
    allowedMethods: [...m.methods],
    remainingMinor: BigInt(m.remainingMinor),
    remainingPurchases: m.remainingPurchases,
  };
}

export interface EvalOptions {
  now: Date;
  method?: MethodId;
  revokedMerchants?: string[];
  frozen?: boolean;
}

export function evaluate(m: MandateLike, p: MockProduct, opts: EvalOptions): Evaluation {
  const mer = merchantOf(p.merchantId);
  const q = quoteOf(p);
  const method = opts.method ?? "fps";
  const revoked = mer.credential === "revoked" || (opts.revokedMerchants ?? []).includes(mer.id);
  const engineProduct = {
    id: p.id,
    category: p.category,
    brand: p.brand.zh,
    spec: p.spec,
    priceMinor: BigInt(p.priceMinor),
    refPriceMinor: BigInt(p.refPriceMinor),
    riskTags: p.riskTags,
  };
  const snap = snapshotOf(m);
  if (opts.frozen && snap.status === "active") {
    snap.status = "revoked";
    snap.revokedAt = opts.now;
  }
  const ctx: EngineContext = {
    now: opts.now,
    mandate: snap,
    buyerCredential: { status: "valid" },
    merchant: {
      id: mer.id,
      name: mer.name.zh,
      credentialStatus: revoked ? "revoked" : "valid",
      registeredAt: new Date(mer.registeredAt),
    },
    product: engineProduct,
    cart: {
      version: 1,
      items: [{ ...engineProduct, qty: 1 }],
      subtotalMinor: q.subtotal,
      shippingMinor: q.shipping,
      consumerFeeMinor: q.fee,
      totalMinor: q.total,
      quoteExpiresAt: new Date(opts.now.getTime() + 15 * 60_000),
    },
    paymentMethod: { id: method, label: method, merchantAccepts: mer.accepts.includes(method), userEnabled: true },
  };
  const d = decideCandidate(ctx);
  return {
    outcome: d.outcome,
    rules: d.rules.map((r) => ({ id: r.id, severity: r.severity })),
    ...q,
  };
}

/** 草稿 → 可评估的授权快照（预览用：剩余=总额，次数=最多次数） */
export function draftAsMandate(f: DraftFields, now: Date, forPreview: boolean): MandateLike {
  return {
    id: "draft",
    version: 1,
    status: "active",
    expiresAt: new Date(now.getTime() + f.days * 86_400_000).toISOString(),
    revokedAt: null,
    categories: f.categories,
    perTxnMinor: f.perTxnMinor,
    totalMinor: f.totalMinor,
    remainingMinor: f.totalMinor,
    maxPurchases: f.maxPurchases,
    remainingPurchases: f.maxPurchases,
    reviewWhen: f.reviewWhen,
    methods: f.methods,
    // 预览检验的是授权边界，不带任务规格（docs/DECISIONS.md 2026-10-02 23:50）
    preferredBrand: forPreview ? null : f.preferredBrand,
    allowSubstituteBrand: f.allowSubstituteBrand,
    minVolumeMl: forPreview ? null : f.minVolumeMl,
  };
}

export const PREVIEW_SCENARIOS = [
  { id: "familiar", productId: "p_a_jia_2l" },
  { id: "watch", productId: "p_a_vitc" },
  { id: "over_cap", productId: "p_b_bing_25l" },
] as const;

export function previewDraft(f: DraftFields, now: Date) {
  const m = draftAsMandate(f, now, true);
  return PREVIEW_SCENARIOS.map((s) => {
    const p = productOf(s.productId);
    return { ...s, product: p, evaluation: evaluate(m, p, { now }) };
  });
}

// ---------- 极速版：确定性、公开的推荐分 ----------

export interface Scored {
  product: MockProduct;
  evaluation: Evaluation;
  score: number;
  parts: { rating: number; sales: number; price: number };
}

/** 推荐分 = 评分 50 + 销量 30 + 含运费总价 20。只用于排序，不参与任何放行判断 */
export function scoreAll(list: { product: MockProduct; evaluation: Evaluation }[]): Scored[] {
  if (list.length === 0) return [];
  const maxSales = Math.max(...list.map((x) => x.product.sales), 1);
  const totals = list.map((x) => x.evaluation.total);
  const maxT = totals.reduce((a, b) => (a > b ? a : b));
  const minT = totals.reduce((a, b) => (a < b ? a : b));
  return list
    .map((x) => {
      const rating = x.product.rating10;
      const sales = Math.round((30 * x.product.sales) / maxSales);
      const price = maxT === minT ? 20 : Number((20n * (maxT - x.evaluation.total)) / (maxT - minT));
      return { ...x, score: rating + sales + price, parts: { rating, sales, price } };
    })
    .sort((a, b) => b.score - a.score || (a.evaluation.total < b.evaluation.total ? -1 : 1));
}

export function candidatesFor(query: "detergent" | "tissue" | "tumbler", exclude: Set<string> = new Set()) {
  const ids: Record<typeof query, string[]> = {
    detergent: ["p_a_jia_2l", "p_a_yi_3l", "p_a_bing_2l", "p_b_jia_2l", "p_b_bing_25l", "p_b_ding_2l"],
    tissue: ["p_a_tissue_3", "p_b_tissue_10"],
    tumbler: ["p_b_tumbler_black", "p_b_tumbler_steel", "p_a_tumbler_matte"],
  };
  return PRODUCTS.filter((p) => ids[query].includes(p.id) && !exclude.has(p.id));
}
