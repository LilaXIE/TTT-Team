// 购物车版本管理。规格：docs/MANUAL.md §3.3 cart_versions。
import type { Tx } from "@/server/db/tx";
import type { CartQuote } from "./quote";

export interface CartVersionSnapshot {
  cartId: string;
  version: number;
  merchantId: string;
  items: CartQuote["items"];
  subtotalMinor: bigint;
  shippingMinor: bigint;
  consumerFeeMinor: bigint;
  totalMinor: bigint;
  methodId: string;
  quoteExpiresAt: Date;
  hash: string;
}

/**
 * 创建购物车版本：若 cart 不存在则建；插入新 cart_version（version 递增）。
 * 返回快照。
 */
export async function createCartVersion(
  tx: Tx,
  taskId: string,
  merchantId: string,
  quote: CartQuote,
  methodId: string,
): Promise<CartVersionSnapshot> {
  // 查找或创建 cart
  let cartId: string;
  const existing = await tx.query<{ id: string; current_version: number }>(
    `SELECT id, current_version FROM carts WHERE task_id = $1 AND merchant_id = $2`,
    [taskId, merchantId],
  );

  if (existing.rowCount === 0) {
    const c = await tx.query<{ id: string }>(
      `INSERT INTO carts (task_id, merchant_id, current_version) VALUES ($1, $2, 1) RETURNING id`,
      [taskId, merchantId],
    );
    cartId = c.rows[0].id;
  } else {
    cartId = existing.rows[0].id;
  }

  // 查询当前最大 version
  const maxVer = await tx.query<{ v: number }>(
    `SELECT COALESCE(MAX(version), 0) AS v FROM cart_versions WHERE cart_id = $1`,
    [cartId],
  );
  const newVersion = maxVer.rows[0].v + 1;

  // 插入新版本
  await tx.query(
    `INSERT INTO cart_versions (cart_id, version, items, subtotal_minor, shipping_minor, consumer_fee_minor, total_minor, method_id, quote_expires_at, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      cartId,
      newVersion,
      JSON.stringify(quote.items),
      quote.subtotalMinor.toString(),
      quote.shippingMinor.toString(),
      quote.consumerFeeMinor.toString(),
      quote.totalMinor.toString(),
      methodId,
      quote.quoteExpiresAt,
      quote.hash,
    ],
  );

  // 更新 carts.current_version
  await tx.query(`UPDATE carts SET current_version = $1 WHERE id = $2`, [newVersion, cartId]);

  return {
    cartId,
    version: newVersion,
    merchantId,
    items: quote.items,
    subtotalMinor: quote.subtotalMinor,
    shippingMinor: quote.shippingMinor,
    consumerFeeMinor: quote.consumerFeeMinor,
    totalMinor: quote.totalMinor,
    methodId,
    quoteExpiresAt: quote.quoteExpiresAt,
    hash: quote.hash,
  };
}

/**
 * 读取购物车版本（结算与确认用）。
 */
export async function getCartVersion(
  tx: Tx,
  cartId: string,
  version: number,
): Promise<CartVersionSnapshot | null> {
  const r = await tx.query<{
    cart_id: string;
    version: number;
    items: unknown;
    subtotal_minor: string;
    shipping_minor: string;
    consumer_fee_minor: string;
    total_minor: string;
    method_id: string;
    quote_expires_at: Date;
    hash: string;
    merchant_id: string;
  }>(
    `SELECT cv.cart_id, cv.version, cv.items, cv.subtotal_minor, cv.shipping_minor, cv.consumer_fee_minor,
            cv.total_minor, cv.method_id, cv.quote_expires_at, cv.hash, c.merchant_id
     FROM cart_versions cv
     JOIN carts c ON c.id = cv.cart_id
     WHERE cv.cart_id = $1 AND cv.version = $2`,
    [cartId, version],
  );

  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  return {
    cartId: row.cart_id,
    version: row.version,
    merchantId: row.merchant_id,
    items: row.items as CartVersionSnapshot["items"],
    subtotalMinor: BigInt(row.subtotal_minor),
    shippingMinor: BigInt(row.shipping_minor),
    consumerFeeMinor: BigInt(row.consumer_fee_minor),
    totalMinor: BigInt(row.total_minor),
    methodId: row.method_id,
    quoteExpiresAt: row.quote_expires_at,
    hash: row.hash,
  };
}
