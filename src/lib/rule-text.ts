// 规则的界面文案（中英各一份）。服务端 src/server/rules/messages.ts 是中文原文，两边按 rule_id 对应。
import type { RuleId } from "@/contracts";
import { fmtMoney } from "./format";
import type { Lang } from "./i18n";
import { merchantOf, quoteOf } from "./mock/catalog";
import type { Category, MockMandate, MockProduct, Tx } from "./mock/types";

export const CATEGORY_LABEL: Record<Category, Tx> = {
  household: { zh: "家居日用", en: "Household" },
  supplement: { zh: "保健品", en: "Supplements" },
  drinkware: { zh: "杯具", en: "Drinkware" },
  alcohol: { zh: "酒类", en: "Alcohol" },
};

export const RULE_TITLE: Record<RuleId, Tx> = {
  MANDATE_REVOKED: { zh: "授权已撤销", en: "Mandate revoked" },
  MANDATE_EXPIRED: { zh: "授权已过期", en: "Mandate expired" },
  MANDATE_COMPLETED: { zh: "次数已用完", en: "No purchases left" },
  BUYER_CREDENTIAL_INVALID: { zh: "买家凭证无效", en: "Buyer credential invalid" },
  MERCHANT_CREDENTIAL_INVALID: { zh: "商家凭证无效", en: "Merchant credential invalid" },
  CATEGORY_NOT_ALLOWED: { zh: "品类不在范围", en: "Category not allowed" },
  MERCHANT_DENIED: { zh: "商家在拒绝名单", en: "Merchant blocked" },
  SPEC_NOT_MET: { zh: "规格不符", en: "Spec not met" },
  CAP_PER_TXN: { zh: "超过单笔上限", en: "Over per-order cap" },
  CAP_TOTAL: { zh: "超过剩余额度", en: "Over remaining budget" },
  USES_EXHAUSTED: { zh: "次数已用完", en: "No purchases left" },
  PAYMENT_METHOD_NOT_ALLOWED: { zh: "支付方式不允许", en: "Payment method not allowed" },
  QUOTE_EXPIRED: { zh: "报价已过期", en: "Quote expired" },
  NEAR_CAP: { zh: "接近单笔上限", en: "Close to cap" },
  SUBSTITUTE_BRAND: { zh: "换了牌子", en: "Different brand" },
  WATCH_CATEGORY: { zh: "先问你的品类", en: "Ask-first category" },
  NEW_MERCHANT: { zh: "新商家", en: "New merchant" },
  PRICE_ABOVE_REF: { zh: "高于参考价", en: "Above reference price" },
  INFO_MISSING: { zh: "信息不全", en: "Missing information" },
};

interface Ctx {
  product: MockProduct;
  mandate: Pick<MockMandate, "perTxnMinor" | "remainingMinor" | "preferredBrand" | "reviewWhen" | "minVolumeMl">;
  now: Date;
}

export function ruleText(id: RuleId, c: Ctx, lang: Lang): string {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const p = c.product;
  const mer = merchantOf(p.merchantId);
  const q = quoteOf(p);
  const money = (v: bigint | string) => fmtMoney(v, lang);
  const merchant = mer.name[lang];
  const category = CATEGORY_LABEL[p.category][lang];
  const cap = BigInt(c.mandate.perTxnMinor);

  switch (id) {
    case "MANDATE_REVOKED":
      return t("这份授权已撤销，Zev 不再付款。已完成的交易保留在记录里。", "This mandate was revoked. Zev will not pay. Finished orders stay in your records.");
    case "MANDATE_EXPIRED":
      return t("这份授权已过期。", "This mandate has expired.");
    case "MANDATE_COMPLETED":
    case "USES_EXHAUSTED":
      return t("这份授权的购买次数已经用完。", "This mandate has no purchases left.");
    case "BUYER_CREDENTIAL_INVALID":
      return t("你的买家凭证暂时无效，Zev 不能代你付款。", "Your buyer credential is not valid, so Zev cannot pay for you.");
    case "MERCHANT_CREDENTIAL_INVALID":
      return t(`${merchant}的商家凭证已撤销，不能向它下单。`, `${merchant}'s merchant credential is revoked. Zev cannot order from it.`);
    case "CATEGORY_NOT_ALLOWED":
      return t(`「${category}」不在你允许的品类里。`, `${category} is outside the categories you allowed.`);
    case "MERCHANT_DENIED":
      return t(`${merchant}在你的拒绝名单里。`, `${merchant} is on your block list.`);
    case "SPEC_NOT_MET":
      return c.mandate.minVolumeMl
        ? t(`容量 ${p.specLabel.zh}，你要求至少 ${c.mandate.minVolumeMl / 1000}L。`, `It is ${p.specLabel.en}; you asked for at least ${c.mandate.minVolumeMl / 1000}L.`)
        : t("规格不满足你的要求。", "It does not meet your spec.");
    case "CAP_PER_TXN":
      return t(`这笔含运费 ${money(q.total)}，超过你设的单笔上限 ${money(cap)}。`, `This order is ${money(q.total)} with shipping, above your per-order cap of ${money(cap)}.`);
    case "CAP_TOTAL":
      return t(`这份授权只剩 ${money(c.mandate.remainingMinor)}，不够付 ${money(q.total)}。`, `Only ${money(c.mandate.remainingMinor)} is left on this mandate, not enough for ${money(q.total)}.`);
    case "PAYMENT_METHOD_NOT_ALLOWED":
      return t("这个支付方式不在授权范围内，或商家不接受。", "This payment method is outside the mandate, or the merchant does not accept it.");
    case "QUOTE_EXPIRED":
      return t("报价已过期，需要重新报价。", "The quote expired and needs refreshing.");
    case "NEAR_CAP": {
      const pct = cap > 0n ? ((q.total * 100n) / cap).toString() : "0";
      return t(`这笔 ${money(q.total)} 已经到单笔上限的 ${pct}%。`, `At ${money(q.total)}, this order reaches ${pct}% of your cap.`);
    }
    case "SUBSTITUTE_BRAND":
      return t(
        `这是${p.brand.zh}，和你常买的${c.mandate.preferredBrand ?? "品牌"}不同。`,
        `This is ${p.brand.en}, not your usual ${brandEn(c.mandate.preferredBrand)}.`,
      );
    case "WATCH_CATEGORY":
      return p.riskTags.includes("health_claim")
        ? t(`「${category}」是你要求先问你的品类；这件商品写了健康功效。`, `You asked to approve ${category} first, and this item makes health claims.`)
        : t(`「${category}」是你要求先问你的品类。`, `You asked to approve ${category} first.`);
    case "NEW_MERCHANT": {
      const days = Math.floor((c.now.getTime() - new Date(mer.registeredAt).getTime()) / 86_400_000);
      return t(`${merchant}注册才 ${days} 天。`, `${merchant} registered only ${days} days ago.`);
    }
    case "PRICE_ABOVE_REF": {
      const ref = BigInt(p.refPriceMinor);
      const pct = ref > 0n ? (((BigInt(p.priceMinor) - ref) * 100n) / ref).toString() : "0";
      return t(`价格比参考价高 ${pct}%。`, `Priced ${pct}% above the reference price.`);
    }
    case "INFO_MISSING":
      return t("缺少信息，补齐后会重新判断。这一条不能靠确认放行。", "Some information is missing. Zev will re-check once it is filled in; confirming cannot skip this.");
  }
}

const BRAND_EN: Record<string, string> = { 品牌甲: "Brand Jia", 品牌乙: "Brand Yi", 品牌丙: "Brand Bing", 品牌丁: "Brand Ding" };
function brandEn(zh: string | null): string {
  return zh ? (BRAND_EN[zh] ?? zh) : "brand";
}
