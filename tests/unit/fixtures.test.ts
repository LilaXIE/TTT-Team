import { describe, expect, it } from "vitest";
import { validateFixtures } from "../../scripts/validate-fixtures";
import { PaymentMethod, type EngineContext, type Product } from "@/contracts/schemas";
import { decide } from "@/server/rules/engine";
import { isCovered } from "@/server/rules/confirmation";

const { catalog, rates, scenarios } = validateFixtures();
const now = new Date("2026-10-03T10:00:00+08:00");
function context(id: string): EngineContext {
  const p = catalog.products.find((p) => p.id === id)!;
  const m = catalog.merchants.find((m) => m.id === p.merchantId)!;
  const product = { ...p, priceMinor: BigInt(p.priceMinor), refPriceMinor: BigInt(p.refPriceMinor) };
  const shippingMinor = BigInt(m.shippingFeeMinor);
  return {
    now,
    mandate: {
      id: "fixture-mandate", version: 1, status: "active", revokedAt: null,
      expiresAt: new Date("2026-10-10T10:00:00+08:00"),
      task: { query: "洗衣液", qty: 1, minSpec: { volumeMl: 2000 }, allowSubstituteBrand: true, preferredBrand: "品牌甲" },
      scope: { categories: ["household"], merchantDeny: [] },
      caps: { perTxnMinor: 15000n, totalMinor: 30000n, maxPurchases: 2 },
      remainingMinor: 30000n, remainingPurchases: 2,
      reviewWhen: { nearCapPct: 95, substituteBrand: true, watchCategories: ["supplement"], newMerchantDays: null, priceAboveRefPct: null },
      allowedMethods: ["fps", "tapngo_mc"],
    },
    buyerCredential: { status: "valid" },
    merchant: { ...m, registeredAt: new Date(m.registeredAt) }, product,
    cart: { version: 1, items: [{ ...product, qty: 1 }], subtotalMinor: product.priceMinor,
      shippingMinor, consumerFeeMinor: 0n, totalMinor: product.priceMinor + shippingMinor,
      quoteExpiresAt: new Date("2026-10-03T10:05:00+08:00") },
    paymentMethod: { id: "fps", label: "FPS", merchantAccepts: true, userEnabled: true },
  };
}
const hits = (ctx: EngineContext) => decide(ctx, "PAY").rules.map((r) => r.id);

describe("real demo fixtures through the rules engine", () => {
  it("both fixed brand-A laundry quotes total 13800 and allow under standard protection", () => {
    for (const id of ["A-LAUNDRY-01", "B-LAUNDRY-01"]) {
      const ctx = context(id);
      expect(ctx.cart!.totalMinor).toBe(13800n);
      expect(decide(ctx, "PAY").outcome).toBe("ALLOW");
    }
  });
  it("15800 exceeds the cap and cannot be confirmed away", () => {
    const ctx = context("B-LAUNDRY-02");
    const decision = decide(ctx, "PAY");
    expect(ctx.cart!.totalMinor).toBe(15800n);
    expect(decision.outcome).toBe("DENY");
    expect(hits(ctx)).toContain("CAP_PER_TXN");
    expect(isCovered(decision, { cartVersion: 1, ruleIds: decision.rules.map((r) => r.id), expiresAt: ctx.cart!.quoteExpiresAt }, 1, now)).toEqual({ covered: false, reason: "DENY" });
  });
  it("brand substitution can pause when a changed user cap permits the total", () => {
    const ctx = context("B-LAUNDRY-02");
    ctx.mandate.caps.perTxnMinor = 20000n;
    expect(decide(ctx, "PAY").outcome).toBe("REVIEW");
    expect(hits(ctx)).toEqual(["SUBSTITUTE_BRAND"]);
  });
  it("revoked merchant C always denies even with supplement scope", () => {
    const ctx = context("C-SUPPLEMENT-01");
    ctx.mandate.scope.categories = ["supplement"];
    ctx.mandate.task.minSpec = {};
    ctx.mandate.task.preferredBrand = null;
    expect(decide(ctx, "PAY").outcome).toBe("DENY");
    expect(hits(ctx)).toContain("MERCHANT_CREDENTIAL_INVALID");
  });
  it("supplement preview reviews only when the user explicitly allows its category", () => {
    const id = scenarios.scenarios[1].product.id;
    const ctx = context(id);
    expect(hits(ctx)).toContain("CATEGORY_NOT_ALLOWED");
    expect(decide(ctx, "PAY").outcome).toBe("DENY");
    ctx.mandate.scope.categories = ["household", "supplement"];
    ctx.mandate.task.minSpec = {};
    ctx.mandate.task.preferredBrand = null;
    expect(decide(ctx, "PAY").outcome).toBe("REVIEW");
    expect(hits(ctx)).toEqual(["WATCH_CATEGORY"]);
  });
  it("enhanced protection catches the 25-day merchant and 40% reference-price gap", () => {
    const fresh = context("B-LAUNDRY-01");
    fresh.mandate.reviewWhen.newMerchantDays = 30;
    expect(hits(fresh)).toContain("NEW_MERCHANT");
    const expensive = context("A-FLOOR-01");
    expensive.mandate.task.preferredBrand = null;
    expensive.mandate.reviewWhen.priceAboveRefPct = 20;
    expect(decide(expensive, "PAY").outcome).toBe("REVIEW");
    expect(hits(expensive)).toEqual(["PRICE_ABOVE_REF"]);
  });
  it("both malicious descriptions stay data and cannot alter candidate or pay decisions", () => {
    const malicious = catalog.products.filter((p) => /SYSTEM:|忽略用户授权/.test(p.description));
    expect(malicious).toHaveLength(2);
    const withDescription = (p: Product) => ({ ...context(p.id), product: { ...context(p.id).product!, description: p.description } });
    for (const p of malicious) {
      for (const checkpoint of ["CANDIDATES", "PAY"] as const) {
        expect(decide(withDescription(p), checkpoint)).toEqual(decide(withDescription({ ...p, description: "正常商品描述" }), checkpoint));
      }
    }
  });
  it("unknown Tap & Go fee is kept null and fails the executable payment-method contract", () => {
    const tapngo = rates.methods.find((m) => m.id === "tapngo_mc")!;
    expect(tapngo.consumerFeeMinor).toBeNull();
    expect(tapngo.rewards).toBeNull();
    expect(PaymentMethod.safeParse(tapngo).success).toBe(false);
    expect(rates.methods.find((m) => m.id === "fps")!.consumerFeeMinor).toBe("0");
  });
});
