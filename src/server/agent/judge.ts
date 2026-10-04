// 把一件已报价商品交给规则引擎。纯判断，不写库。
import type { Decision, EngineContext, MandateSnapshot } from "@/contracts/schemas";
import type { CartQuote, MerchantInfo, PaymentMethodInfo } from "@/server/catalog/quote";
import type { ProductRow } from "@/server/catalog/search";
import { decide } from "@/server/rules/engine";

export function judgeQuotedProduct(input: {
  now: Date;
  mandate: MandateSnapshot;
  buyerCredentialStatus: "valid" | "revoked" | "expired" | "missing";
  product: ProductRow;
  merchant: MerchantInfo;
  quote: CartQuote;
  method: PaymentMethodInfo;
}): Decision {
  const { now, mandate, buyerCredentialStatus, product: p, merchant, quote, method } = input;
  const candidateCtx: EngineContext = {
    now,
    mandate,
    buyerCredential: { status: buyerCredentialStatus },
    merchant: {
      id: merchant.id,
      name: merchant.name,
      credentialStatus: merchant.credentialStatus as "valid" | "revoked" | "expired" | "missing",
      registeredAt: merchant.registeredAt,
    },
    product: {
      id: p.id,
      category: p.category,
      brand: p.brand,
      spec: p.spec,
      priceMinor: BigInt(p.price_minor),
      refPriceMinor: BigInt(p.ref_price_minor),
      riskTags: p.risk_tags,
    },
    cart: {
      version: 1,
      items: quote.items.map((item) => ({
        id: item.productId,
        category: item.category,
        brand: item.brand,
        spec: item.spec,
        priceMinor: item.unitPriceMinor,
        refPriceMinor: item.refPriceMinor,
        riskTags: item.riskTags,
        qty: item.qty,
      })),
      subtotalMinor: quote.subtotalMinor,
      shippingMinor: quote.shippingMinor,
      consumerFeeMinor: quote.consumerFeeMinor,
      totalMinor: quote.totalMinor,
      quoteExpiresAt: quote.quoteExpiresAt,
    },
    paymentMethod: {
      id: method.id,
      label: method.label,
      merchantAccepts: merchant.acceptsMethods.includes(method.id),
      userEnabled: true,
    },
  };
  const candidateDecision = decide(candidateCtx, "CANDIDATES");
  const quoteDecision = decide(candidateCtx, "QUOTE");
  const routeDecision = decide(candidateCtx, "ROUTE");
  const allRules = [...candidateDecision.rules, ...quoteDecision.rules, ...routeDecision.rules];
  const deduped = Array.from(new Map(allRules.map((r) => [r.id, r])).values());
  const hasDeny = deduped.some((r) => r.severity === "DENY");
  const hasReview = deduped.some((r) => r.severity === "REVIEW");
  const outcome = hasDeny ? "DENY" : hasReview ? "REVIEW" : "ALLOW";
  return {
    outcome,
    checkpoint: "CANDIDATES",
    rules: deduped.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "DENY" ? -1 : 1)),
    mandateVersion: mandate.version,
    evaluatedAt: now.toISOString(),
  };
}
