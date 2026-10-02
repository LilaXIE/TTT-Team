// 购物车报价。规格：docs/MANUAL.md §6.5 预算口径：商品 + 运费 + 消费者手续费。
import { createHash } from "node:crypto";
import type { ProductRow } from "./search";

export interface QuoteItem {
  productId: string;
  name: string;
  brand: string;
  category: string;
  qty: number;
  unitPriceMinor: bigint;
  spec: Record<string, number>;
  riskTags: string[];
  refPriceMinor: bigint;
}

export interface MerchantInfo {
  id: string;
  name: string;
  shippingFeeMinor: bigint;
  freeShippingOverMinor: bigint | null;
  deliveryDays: number;
  returnDays: number;
  acceptsMethods: string[];
  credentialStatus: string;
  registeredAt: Date;
}

export interface PaymentMethodInfo {
  id: string;
  label: string;
  consumerFeeMinor: bigint;
}

export interface CartQuote {
  items: QuoteItem[];
  subtotalMinor: bigint;
  shippingMinor: bigint;
  consumerFeeMinor: bigint;
  totalMinor: bigint;
  quoteExpiresAt: Date;
  hash: string;
}

/**
 * 购物车报价：计算商品、运费、手续费。
 * totalMinor = subtotalMinor + shippingMinor + consumerFeeMinor（MANUAL §6.5）
 */
export function quoteCart(
  merchant: MerchantInfo,
  products: Array<ProductRow & { qty: number }>,
  method: PaymentMethodInfo,
  now = new Date(),
): CartQuote {
  const items: QuoteItem[] = products.map((p) => ({
    productId: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    qty: p.qty,
    unitPriceMinor: BigInt(p.price_minor),
    spec: p.spec,
    riskTags: p.risk_tags,
    refPriceMinor: BigInt(p.ref_price_minor),
  }));

  const subtotalMinor = items.reduce((sum, item) => sum + item.unitPriceMinor * BigInt(item.qty), 0n);

  // 运费：满减规则
  let shippingMinor = merchant.shippingFeeMinor;
  if (merchant.freeShippingOverMinor !== null && subtotalMinor >= merchant.freeShippingOverMinor) {
    shippingMinor = 0n;
  }

  const consumerFeeMinor = method.consumerFeeMinor;
  const totalMinor = subtotalMinor + shippingMinor + consumerFeeMinor;

  // 报价 5 分钟有效
  const quoteExpiresAt = new Date(now.getTime() + 5 * 60_000);

  // hash = sha256(规范化 JSON)
  const canonical = JSON.stringify({
    merchantId: merchant.id,
    items: items.map((i) => ({ id: i.productId, qty: i.qty, price: i.unitPriceMinor.toString() })),
    shipping: shippingMinor.toString(),
    fee: consumerFeeMinor.toString(),
    total: totalMinor.toString(),
    methodId: method.id,
  });
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");

  return { items, subtotalMinor, shippingMinor, consumerFeeMinor, totalMinor, quoteExpiresAt, hash };
}
