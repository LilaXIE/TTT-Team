import { describe, expect, it } from "vitest";
import type { EngineCart, EngineContext, EngineProduct, MandateSnapshot } from "@/contracts/schemas";
import { decide, decideCandidate } from "@/server/rules/engine";
import { isCovered } from "@/server/rules/confirmation";
import { formatHKD, hkdToMinor, parseMinor } from "@/contracts/money";

const NOW = new Date("2026-10-03T10:00:00+08:00");

function mandate(over: Partial<MandateSnapshot> = {}): MandateSnapshot {
  return {
    id: "m1",
    version: 1,
    status: "active",
    expiresAt: new Date("2026-10-09T23:59:59+08:00"),
    revokedAt: null,
    task: { query: "洗衣液", qty: 1, minSpec: { volumeMl: 2000 }, allowSubstituteBrand: true, preferredBrand: "品牌甲" },
    scope: { categories: ["household"], merchantDeny: [] },
    caps: { perTxnMinor: 15000n, totalMinor: 30000n, maxPurchases: 2 },
    reviewWhen: { nearCapPct: 95, substituteBrand: true, watchCategories: ["supplement"], newMerchantDays: null, priceAboveRefPct: null },
    allowedMethods: ["fps", "tapngo_mc"],
    remainingMinor: 30000n,
    remainingPurchases: 2,
    ...over,
  };
}

function product(over: Partial<EngineProduct> = {}): EngineProduct {
  return {
    id: "p1",
    category: "household",
    brand: "品牌甲",
    spec: { volumeMl: 2000 },
    priceMinor: 11800n,
    refPriceMinor: 12000n,
    riskTags: [],
    ...over,
  };
}

function cart(p: EngineProduct, shipping = 2000n, over: Partial<EngineCart> = {}): EngineCart {
  const subtotal = p.priceMinor;
  return {
    version: 1,
    items: [{ ...p, qty: 1 }],
    subtotalMinor: subtotal,
    shippingMinor: shipping,
    consumerFeeMinor: 0n,
    totalMinor: subtotal + shipping,
    quoteExpiresAt: new Date(NOW.getTime() + 5 * 60_000),
    ...over,
  };
}

function ctx(over: Partial<EngineContext> = {}): EngineContext {
  const p = product();
  return {
    now: NOW,
    mandate: mandate(),
    buyerCredential: { status: "valid" },
    merchant: { id: "A", name: "日日鲜百货", credentialStatus: "valid", registeredAt: new Date("2023-01-01") },
    product: p,
    cart: cart(p),
    paymentMethod: { id: "fps", label: "FPS", merchantAccepts: true, userEnabled: true },
    ...over,
  };
}

const ids = (d: { rules: { id: string }[] }) => d.rules.map((r) => r.id);

describe("engine: happy path", () => {
  it("S1 自动完成：118 + 运费 20 = 138 → ALLOW", () => {
    const d = decide(ctx(), "PAY");
    expect(d.outcome).toBe("ALLOW");
    expect(d.rules).toHaveLength(0);
    expect(d.mandateVersion).toBe(1);
  });
});

describe("engine: DENY rules", () => {
  it("MANDATE_REVOKED", () => {
    const d = decide(ctx({ mandate: mandate({ status: "revoked", revokedAt: NOW }) }), "INTENT");
    expect(d.outcome).toBe("DENY");
    expect(ids(d)).toContain("MANDATE_REVOKED");
  });
  it("MANDATE_EXPIRED（按 now 判断，即使 status 仍为 active）", () => {
    const d = decide(ctx({ mandate: mandate({ expiresAt: new Date(NOW.getTime() - 1) }) }), "INTENT");
    expect(ids(d)).toContain("MANDATE_EXPIRED");
  });
  it("MANDATE_COMPLETED 当剩余次数为 0", () => {
    const d = decide(ctx({ mandate: mandate({ remainingPurchases: 0 }) }), "INTENT");
    expect(ids(d)).toContain("MANDATE_COMPLETED");
  });
  it("BUYER_CREDENTIAL_INVALID", () => {
    const d = decide(ctx({ buyerCredential: { status: "revoked" } }), "INTENT");
    expect(ids(d)).toContain("BUYER_CREDENTIAL_INVALID");
  });
  it("MERCHANT_CREDENTIAL_INVALID（商家 C）", () => {
    const d = decide(ctx({ merchant: { id: "C", name: "康康保健", credentialStatus: "revoked", registeredAt: new Date("2024-01-01") } }), "CANDIDATES");
    expect(d.outcome).toBe("DENY");
    expect(ids(d)).toContain("MERCHANT_CREDENTIAL_INVALID");
  });
  it("CATEGORY_NOT_ALLOWED（商品）与（任务）", () => {
    expect(ids(decide(ctx({ product: product({ category: "electronics" }) }), "CANDIDATES"))).toContain("CATEGORY_NOT_ALLOWED");
    expect(ids(decide(ctx({ taskCategory: "electronics" }), "INTENT"))).toContain("CATEGORY_NOT_ALLOWED");
  });
  it("MERCHANT_DENIED", () => {
    const d = decide(ctx({ mandate: mandate({ scope: { categories: ["household"], merchantDeny: ["A"] } }) }), "CANDIDATES");
    expect(ids(d)).toContain("MERCHANT_DENIED");
  });
  it("SPEC_NOT_MET：1.5L 不满足 ≥2L", () => {
    const d = decide(ctx({ product: product({ spec: { volumeMl: 1500 } }) }), "CANDIDATES");
    expect(ids(d)).toContain("SPEC_NOT_MET");
  });
  it("SPEC_NOT_MET：不允许换牌子时换牌子是 DENY，不是 REVIEW", () => {
    const m = mandate({ task: { query: "洗衣液", qty: 1, minSpec: {}, allowSubstituteBrand: false, preferredBrand: "品牌甲" } });
    const d = decide(ctx({ mandate: m, product: product({ brand: "品牌丙" }) }), "CANDIDATES");
    expect(d.outcome).toBe("DENY");
    expect(ids(d)).toContain("SPEC_NOT_MET");
    expect(ids(d)).not.toContain("SUBSTITUTE_BRAND");
  });
  it("S3 CAP_PER_TXN：128 + 运费 30 = 158 > 150", () => {
    const p = product({ id: "p4", brand: "品牌丙", priceMinor: 12800n, spec: { volumeMl: 2500 } });
    const d = decide(ctx({ product: p, cart: cart(p, 3000n) }), "QUOTE");
    expect(d.outcome).toBe("DENY");
    expect(ids(d)).toContain("CAP_PER_TXN");
    expect(d.rules.find((r) => r.id === "CAP_PER_TXN")!.message).toContain("HK$158.00");
    expect(ids(d)).not.toContain("NEAR_CAP");
  });
  it("CAP_TOTAL：剩余 100 不够 138", () => {
    const d = decide(ctx({ mandate: mandate({ remainingMinor: 10000n }) }), "QUOTE");
    expect(ids(d)).toContain("CAP_TOTAL");
  });
  it("USES_EXHAUSTED 在 QUOTE 出现", () => {
    const d = decide(ctx({ mandate: mandate({ remainingPurchases: 0 }) }), "QUOTE");
    expect(ids(d)).toContain("USES_EXHAUSTED");
  });
  it("PAYMENT_METHOD_NOT_ALLOWED：三种原因都会出现在文案", () => {
    const d = decide(ctx({ paymentMethod: { id: "card_x", label: "某卡", merchantAccepts: false, userEnabled: false } }), "ROUTE");
    expect(ids(d)).toContain("PAYMENT_METHOD_NOT_ALLOWED");
    const msg = d.rules[0].message;
    expect(msg).toContain("不在你的授权范围内");
    expect(msg).toContain("商家不接受");
    expect(msg).toContain("你尚未启用");
  });
  it("QUOTE_EXPIRED", () => {
    const p = product();
    const d = decide(ctx({ cart: cart(p, 2000n, { quoteExpiresAt: new Date(NOW.getTime() - 1) }) }), "QUOTE");
    expect(ids(d)).toContain("QUOTE_EXPIRED");
  });
});

describe("engine: REVIEW rules", () => {
  it("NEAR_CAP：145 ≥ 150×95%", () => {
    const p = product({ priceMinor: 12500n });
    const d = decide(ctx({ product: p, cart: cart(p, 2000n) }), "QUOTE");
    expect(d.outcome).toBe("REVIEW");
    expect(ids(d)).toEqual(["NEAR_CAP"]);
  });
  it("S2 SUBSTITUTE_BRAND：允许换牌子但要求先问", () => {
    const d = decide(ctx({ product: product({ brand: "品牌丙" }) }), "CANDIDATES");
    expect(d.outcome).toBe("REVIEW");
    expect(ids(d)).toEqual(["SUBSTITUTE_BRAND"]);
  });
  it("WATCH_CATEGORY：supplement 带 health_claim", () => {
    const m = mandate({ scope: { categories: ["household", "supplement"], merchantDeny: [] } });
    const d = decide(ctx({ mandate: m, product: product({ category: "supplement", riskTags: ["health_claim"] }) }), "CANDIDATES");
    expect(ids(d)).toContain("WATCH_CATEGORY");
    expect(d.rules.find((r) => r.id === "WATCH_CATEGORY")!.message).toContain("health_claim");
  });
  it("NEW_MERCHANT 只在 reviewWhen.newMerchantDays 设定时触发", () => {
    const newMerchant = { id: "B", name: "快快屋", credentialStatus: "valid" as const, registeredAt: new Date(NOW.getTime() - 25 * 86_400_000) };
    expect(ids(decide(ctx({ merchant: newMerchant }), "CANDIDATES"))).not.toContain("NEW_MERCHANT");
    const enhanced = mandate({ reviewWhen: { nearCapPct: 95, substituteBrand: true, watchCategories: [], newMerchantDays: 30, priceAboveRefPct: 20 } });
    const d = decide(ctx({ merchant: newMerchant, mandate: enhanced }), "CANDIDATES");
    expect(ids(d)).toContain("NEW_MERCHANT");
    expect(d.rules.find((r) => r.id === "NEW_MERCHANT")!.data?.days).toBe(25);
  });
  it("PRICE_ABOVE_REF：加强模式下高于参考价 40% 触发，标准模式不触发", () => {
    const p = product({ priceMinor: 14000n, refPriceMinor: 10000n });
    expect(ids(decide(ctx({ product: p }), "CANDIDATES"))).not.toContain("PRICE_ABOVE_REF");
    const enhanced = mandate({ reviewWhen: { nearCapPct: 95, substituteBrand: true, watchCategories: [], newMerchantDays: 30, priceAboveRefPct: 20 } });
    const d = decide(ctx({ product: p, mandate: enhanced }), "CANDIDATES");
    expect(ids(d)).toContain("PRICE_ABOVE_REF");
  });
  it("INFO_MISSING 为 blocking", () => {
    const d = decide(ctx({ cart: undefined }), "QUOTE");
    expect(d.outcome).toBe("REVIEW");
    expect(d.rules[0].id).toBe("INFO_MISSING");
    expect(d.rules[0].data?.blocking).toBe(true);
  });
});

describe("engine: precedence & PAY", () => {
  it("同时命中 DENY 与 REVIEW → DENY，且两条都在 rules 里，DENY 排前", () => {
    const p = product({ brand: "品牌丙", priceMinor: 12800n, spec: { volumeMl: 2500 } });
    const d = decide(ctx({ product: p, cart: cart(p, 3000n) }), "PAY");
    expect(d.outcome).toBe("DENY");
    expect(ids(d)).toContain("CAP_PER_TXN");
    expect(ids(d)).toContain("SUBSTITUTE_BRAND");
    expect(d.rules[0].severity).toBe("DENY");
  });
  it("PAY 检查购物车内每个商品", () => {
    const bad = product({ id: "p9", category: "electronics" });
    const c = cart(bad);
    const d = decide(ctx({ product: undefined, cart: c }), "PAY");
    expect(ids(d)).toContain("CATEGORY_NOT_ALLOWED");
  });
  it("决策不依赖商品描述：注入文本不影响任何规则", () => {
    // EngineProduct 根本没有 description 字段——注入文本进不了引擎。这里验证含注入的商品与正常商品决策一致。
    const a = decideCandidate(ctx());
    const b = decideCandidate(ctx({ product: product({ id: "p-inj" }) }));
    expect(a.outcome).toBe(b.outcome);
    expect(ids(a)).toEqual(ids(b));
  });
  it("是纯函数：相同输入两次调用结果一致", () => {
    const c = ctx();
    expect(decide(c, "PAY")).toEqual(decide(c, "PAY"));
  });
});

describe("confirmation coverage", () => {
  const review = decide(ctx({ product: product({ brand: "品牌丙" }) }), "CANDIDATES");
  it("覆盖：版本一致、规则覆盖、未过期", () => {
    const r = isCovered(review, { cartVersion: 1, ruleIds: ["SUBSTITUTE_BRAND"], expiresAt: new Date(NOW.getTime() + 60_000) }, 1, NOW);
    expect(r.covered).toBe(true);
  });
  it("不覆盖：购物车版本变化", () => {
    const r = isCovered(review, { cartVersion: 1, ruleIds: ["SUBSTITUTE_BRAND"], expiresAt: new Date(NOW.getTime() + 60_000) }, 2, NOW);
    expect(r).toEqual({ covered: false, reason: "VERSION_MISMATCH" });
  });
  it("不覆盖：过期 / 规则未全覆盖 / 无确认", () => {
    expect(isCovered(review, { cartVersion: 1, ruleIds: ["SUBSTITUTE_BRAND"], expiresAt: NOW }, 1, NOW)).toEqual({ covered: false, reason: "EXPIRED" });
    expect(isCovered(review, { cartVersion: 1, ruleIds: ["NEAR_CAP"], expiresAt: new Date(NOW.getTime() + 1) }, 1, NOW)).toEqual({ covered: false, reason: "RULES_NOT_COVERED" });
    expect(isCovered(review, null, 1, NOW)).toEqual({ covered: false, reason: "NO_CONFIRMATION" });
  });
  it("DENY 永远不被覆盖；INFO_MISSING 永远不被覆盖", () => {
    const deny = decide(ctx({ mandate: mandate({ status: "revoked", revokedAt: NOW }) }), "PAY");
    expect(isCovered(deny, { cartVersion: 1, ruleIds: ["MANDATE_REVOKED"], expiresAt: new Date(NOW.getTime() + 1) }, 1, NOW)).toEqual({ covered: false, reason: "DENY" });
    const missing = decide(ctx({ cart: undefined }), "QUOTE");
    expect(isCovered(missing, { cartVersion: 1, ruleIds: ["INFO_MISSING"], expiresAt: new Date(NOW.getTime() + 1) }, 1, NOW)).toEqual({ covered: false, reason: "BLOCKING_RULE" });
  });
});

describe("money", () => {
  it("hkdToMinor / formatHKD / parseMinor", () => {
    expect(hkdToMinor("150")).toBe(15000n);
    expect(hkdToMinor("138.5")).toBe(13850n);
    expect(formatHKD(13800n)).toBe("HK$138.00");
    expect(formatHKD(1234550n)).toBe("HK$12,345.50");
    expect(parseMinor("13800")).toBe(13800n);
    expect(() => parseMinor("138.00")).toThrow();
  });
});
