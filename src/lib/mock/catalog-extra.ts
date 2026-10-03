import catalog from "../../../fixtures/catalog.json";
import type { Category, MockProduct } from "./types";

const MERCHANT: Record<string, string> = {
  A: "m_ririxian",
  B: "m_kuaikuai",
  C: "m_kangkang",
};

const TONE: Record<string, string> = {
  A: "#6E62E6",
  B: "#3B3A42",
  C: "#8A7A62",
};

type FixtureProduct = (typeof catalog.products)[number];

function categoryOf(p: FixtureProduct): Category {
  if (p.category === "supplement") return "supplement";
  if (p.category === "electronics") return "electronics";
  if (p.category === "alcohol") return "alcohol";
  if (/杯/.test(p.name)) return "drinkware";
  return "household";
}

function specLabel(spec: Record<string, number>): string {
  const parts = Object.entries(spec).map(([k, v]) => `${k} ${v}`);
  return parts.join(" · ");
}

/** 把 fixtures 里扩到 98 件的目录接到页面能搜到的商品上。演示脚本用的洗衣液不重复加入。 */
export function extraProducts(): MockProduct[] {
  return catalog.products
    .filter((p) => !/洗衣液/.test(p.name))
    .map((p) => {
      const label = specLabel(p.spec as Record<string, number>);
      return {
        id: `fx_${p.id}`,
        merchantId: MERCHANT[p.merchantId] ?? "m_ririxian",
        name: { zh: p.name, en: p.name },
        brand: { zh: p.brand, en: p.brand },
        category: categoryOf(p),
        spec: p.spec as Record<string, number>,
        specLabel: { zh: label || p.name, en: label || p.name },
        priceMinor: p.priceMinor,
        refPriceMinor: p.refPriceMinor,
        rating10: 45,
        sales: p.stockQty,
        riskTags: p.riskTags,
        description: { zh: p.description, en: p.description },
        injected: /SYSTEM|ignore|AI AGENTS/i.test(p.description),
        tone: TONE[p.merchantId] ?? "#6E62E6",
      };
    });
}
