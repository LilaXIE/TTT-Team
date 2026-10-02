// 规则引擎：纯函数。无 I/O、无随机、无 Date.now()。时间来自 ctx.now。
// 规格：docs/MANUAL.md §5。
import { formatHKD } from "@/contracts/money";
import { isDenyRule, type RuleId } from "@/contracts/rules";
import type {
  Checkpoint,
  Decision,
  EngineContext,
  EngineProduct,
  Outcome,
  RuleHit,
} from "@/contracts/schemas";
import { render } from "./messages";

type Data = NonNullable<RuleHit["data"]>;

function hit(id: RuleId, data: Data = {}): RuleHit {
  const h: RuleHit = { id, severity: isDenyRule(id) ? "DENY" : "REVIEW", message: "", data };
  h.message = render(h);
  return h;
}

function fmtTime(d: Date): string {
  // 固定格式，避免依赖运行环境 locale
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

// ---------------- 规则组 ----------------

function mandateRules(ctx: EngineContext): RuleHit[] {
  const m = ctx.mandate;
  const out: RuleHit[] = [];
  if (m.status === "revoked") out.push(hit("MANDATE_REVOKED", { time: m.revokedAt ? fmtTime(m.revokedAt) : "" }));
  else if (m.status === "expired" || ctx.now.getTime() >= m.expiresAt.getTime())
    out.push(hit("MANDATE_EXPIRED", { time: fmtTime(m.expiresAt) }));
  else if (m.status === "completed" || m.remainingPurchases <= 0) out.push(hit("MANDATE_COMPLETED"));
  if (ctx.buyerCredential.status !== "valid")
    out.push(hit("BUYER_CREDENTIAL_INVALID", { status: ctx.buyerCredential.status }));
  return out;
}

function intentRules(ctx: EngineContext): RuleHit[] {
  const out: RuleHit[] = [];
  if (ctx.taskCategory && !ctx.mandate.scope.categories.includes(ctx.taskCategory))
    out.push(hit("CATEGORY_NOT_ALLOWED", { category: ctx.taskCategory }));
  return out;
}

function merchantRules(ctx: EngineContext): RuleHit[] {
  const out: RuleHit[] = [];
  const mer = ctx.merchant;
  if (!mer) return out;
  if (mer.credentialStatus !== "valid")
    out.push(hit("MERCHANT_CREDENTIAL_INVALID", { merchant: mer.name, status: mer.credentialStatus }));
  if (ctx.mandate.scope.merchantDeny.includes(mer.id)) out.push(hit("MERCHANT_DENIED", { merchant: mer.name }));
  const nd = ctx.mandate.reviewWhen.newMerchantDays;
  if (nd !== null && nd !== undefined) {
    const days = daysBetween(ctx.now, mer.registeredAt);
    if (days < nd) out.push(hit("NEW_MERCHANT", { merchant: mer.name, days }));
  }
  return out;
}

function productRules(ctx: EngineContext, p: EngineProduct): RuleHit[] {
  const out: RuleHit[] = [];
  const m = ctx.mandate;

  if (!m.scope.categories.includes(p.category)) out.push(hit("CATEGORY_NOT_ALLOWED", { category: p.category }));

  // 规格
  for (const [k, min] of Object.entries(m.task.minSpec ?? {})) {
    const v = p.spec?.[k];
    if (v === undefined || v < min)
      out.push(hit("SPEC_NOT_MET", { reason: `${k}=${v ?? "未知"}`, required: `${k} ≥ ${min}` }));
  }

  // 品牌
  const preferred = m.task.preferredBrand;
  if (preferred && p.brand !== preferred) {
    if (!m.task.allowSubstituteBrand)
      out.push(hit("SPEC_NOT_MET", { reason: `品牌为「${p.brand}」`, required: `品牌「${preferred}」` }));
    else if (m.reviewWhen.substituteBrand) out.push(hit("SUBSTITUTE_BRAND", { brand: p.brand, preferred }));
  }

  // 高关注类别
  if (m.reviewWhen.watchCategories.includes(p.category)) {
    const tags = p.riskTags.length ? `；该商品带有「${p.riskTags.join("、")}」标签` : "";
    out.push(hit("WATCH_CATEGORY", { category: p.category, tags }));
  }

  // 价格偏离
  const pct = m.reviewWhen.priceAboveRefPct;
  if (pct !== null && pct !== undefined && p.refPriceMinor > 0n) {
    const diff = p.priceMinor - p.refPriceMinor;
    if (diff > 0n && diff * 100n > p.refPriceMinor * BigInt(pct)) {
      out.push(
        hit("PRICE_ABOVE_REF", {
          price: formatHKD(p.priceMinor),
          ref: formatHKD(p.refPriceMinor),
          pct: Number((diff * 100n) / p.refPriceMinor),
        }),
      );
    }
  }
  return out;
}

function quoteRules(ctx: EngineContext): RuleHit[] {
  const out: RuleHit[] = [];
  const m = ctx.mandate;
  const cart = ctx.cart;
  if (!cart || !ctx.merchant) {
    const missing = [!cart && "报价", !ctx.merchant && "商家信息"].filter(Boolean).join("、");
    out.push(hit("INFO_MISSING", { fields: missing, blocking: true }));
    return out;
  }
  if (ctx.now.getTime() >= cart.quoteExpiresAt.getTime())
    out.push(hit("QUOTE_EXPIRED", { time: fmtTime(cart.quoteExpiresAt) }));

  const total = cart.totalMinor;
  if (total > m.caps.perTxnMinor) out.push(hit("CAP_PER_TXN", { total: formatHKD(total), cap: formatHKD(m.caps.perTxnMinor) }));
  else if (m.reviewWhen.nearCapPct !== null && m.reviewWhen.nearCapPct !== undefined) {
    const pct = m.reviewWhen.nearCapPct;
    if (m.caps.perTxnMinor > 0n && total * 100n >= m.caps.perTxnMinor * BigInt(pct)) {
      out.push(
        hit("NEAR_CAP", {
          total: formatHKD(total),
          cap: formatHKD(m.caps.perTxnMinor),
          pct: Number((total * 100n) / m.caps.perTxnMinor),
        }),
      );
    }
  }
  if (total > m.remainingMinor) out.push(hit("CAP_TOTAL", { remaining: formatHKD(m.remainingMinor), total: formatHKD(total) }));
  if (m.remainingPurchases <= 0) out.push(hit("USES_EXHAUSTED"));
  return out;
}

function routeRules(ctx: EngineContext): RuleHit[] {
  const out: RuleHit[] = [];
  const pm = ctx.paymentMethod;
  if (!pm) {
    out.push(hit("INFO_MISSING", { fields: "支付方式", blocking: true }));
    return out;
  }
  const reasons: string[] = [];
  if (!ctx.mandate.allowedMethods.includes(pm.id)) reasons.push("不在你的授权范围内");
  if (!pm.merchantAccepts) reasons.push("商家不接受");
  if (!pm.userEnabled) reasons.push("你尚未启用");
  if (reasons.length) out.push(hit("PAYMENT_METHOD_NOT_ALLOWED", { method: pm.label, reason: reasons.join("，") }));
  return out;
}

// ---------------- 入口 ----------------

function dedupe(hits: RuleHit[]): RuleHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.id}|${h.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function outcomeOf(hits: RuleHit[]): Outcome {
  if (hits.some((h) => h.severity === "DENY")) return "DENY";
  if (hits.some((h) => h.severity === "REVIEW")) return "REVIEW";
  return "ALLOW";
}

export function decide(ctx: EngineContext, checkpoint: Checkpoint): Decision {
  let hits: RuleHit[] = [...mandateRules(ctx)];

  switch (checkpoint) {
    case "INTENT":
      hits.push(...intentRules(ctx));
      break;
    case "CANDIDATES":
      hits.push(...merchantRules(ctx));
      if (ctx.product) hits.push(...productRules(ctx, ctx.product));
      else hits.push(hit("INFO_MISSING", { fields: "商品信息", blocking: true }));
      break;
    case "QUOTE":
      hits.push(...quoteRules(ctx));
      break;
    case "ROUTE":
      hits.push(...routeRules(ctx));
      break;
    case "PAY":
      hits.push(...intentRules(ctx));
      hits.push(...merchantRules(ctx));
      if (ctx.cart) for (const item of ctx.cart.items) hits.push(...productRules(ctx, item));
      hits.push(...quoteRules(ctx));
      hits.push(...routeRules(ctx));
      break;
  }

  hits = dedupe(hits);
  // DENY 排前面，便于界面展示
  hits.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "DENY" ? -1 : 1));

  return {
    outcome: outcomeOf(hits),
    checkpoint,
    rules: hits,
    mandateVersion: ctx.mandate.version,
    evaluatedAt: ctx.now.toISOString(),
  };
}

/** 一次性评估候选商品：CANDIDATES + 以该商品构造的 QUOTE，合并规则。预览与候选表共用。 */
export function decideCandidate(ctx: EngineContext): Decision {
  const a = decide(ctx, "CANDIDATES");
  const b = ctx.cart ? decide(ctx, "QUOTE") : { rules: [] as RuleHit[] };
  const c = ctx.paymentMethod ? decide(ctx, "ROUTE") : { rules: [] as RuleHit[] };
  const rules = dedupe([...a.rules, ...b.rules, ...c.rules]).sort((x, y) =>
    x.severity === y.severity ? 0 : x.severity === "DENY" ? -1 : 1,
  );
  return { ...a, rules, outcome: outcomeOf(rules) };
}
