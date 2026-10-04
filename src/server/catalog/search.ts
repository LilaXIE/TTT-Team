// 商品目录搜索。规格：docs/MANUAL.md §6.1 步骤 3。
import type { Tx } from "@/server/db/tx";
import { query } from "@/server/db/tx";

export interface SearchOptions {
  categories?: string[];
  includeUnverified?: boolean;
  limit?: number;
}

export interface ProductRow {
  id: string;
  merchant_id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  spec: Record<string, number>;
  description: string;
  price_minor: string;
  ref_price_minor: string;
  stock_qty: number;
  risk_tags: string[];
  image_url: string | null;
  merchant_name: string;
  merchant_registered_at: Date;
  merchant_shipping_fee_minor: string;
  merchant_free_shipping_over_minor: string | null;
  merchant_delivery_days: number;
  merchant_return_days: number;
  merchant_accepts_methods: string[];
  merchant_credential_status: string;
}

/**
 * 搜索可购买商品：status=published、stock>0、商家凭证 valid（除非 includeUnverified）。
 * 返回商品与商家完整信息。商品描述不作为权限输入。
 */
export async function searchProducts(
  queryText: string,
  options: SearchOptions = {},
): Promise<ProductRow[]> {
  const { categories, includeUnverified = false, limit = 50 } = options;
  const pattern = `%${queryText.trim().toLowerCase()}%`;

  let sql = `
    SELECT
      p.id, p.merchant_id, p.sku, p.name, p.brand, p.category, p.spec, p.description,
      p.price_minor, p.ref_price_minor, p.stock_qty, p.risk_tags, p.image_url,
      m.name AS merchant_name, m.registered_at AS merchant_registered_at,
      m.shipping_fee_minor AS merchant_shipping_fee_minor,
      m.free_shipping_over_minor AS merchant_free_shipping_over_minor,
      m.delivery_days AS merchant_delivery_days, m.return_days AS merchant_return_days,
      m.accepts_methods AS merchant_accepts_methods,
      COALESCE(c.status, 'missing') AS merchant_credential_status
    FROM products p
    JOIN merchants m ON m.id = p.merchant_id
    LEFT JOIN credentials c ON c.subject_type = 'merchant' AND c.subject_id = m.id AND c.type = 'merchant_license'
    WHERE p.status = 'published'
      AND p.stock_qty > 0
      AND (LOWER(p.name) LIKE $1 OR LOWER(p.brand) LIKE $1 OR LOWER(p.category) LIKE $1)
  `;

  const params: unknown[] = [pattern];
  let paramIdx = 2;

  if (!includeUnverified) {
    sql += ` AND c.status = 'valid'`;
  }

  if (categories && categories.length > 0) {
    sql += ` AND p.category = ANY($${paramIdx})`;
    params.push(categories);
    paramIdx++;
  }

  sql += ` ORDER BY p.price_minor ASC LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows as unknown as ProductRow[];
}

/** 事务内搜索（结算时用） */
export async function searchProductsTx(
  tx: Tx,
  queryText: string,
  options: SearchOptions = {},
): Promise<ProductRow[]> {
  const { categories, includeUnverified = false, limit = 50 } = options;
  const pattern = `%${queryText.trim().toLowerCase()}%`;

  let sql = `
    SELECT
      p.id, p.merchant_id, p.sku, p.name, p.brand, p.category, p.spec, p.description,
      p.price_minor, p.ref_price_minor, p.stock_qty, p.risk_tags, p.image_url,
      m.name AS merchant_name, m.registered_at AS merchant_registered_at,
      m.shipping_fee_minor AS merchant_shipping_fee_minor,
      m.free_shipping_over_minor AS merchant_free_shipping_over_minor,
      m.delivery_days AS merchant_delivery_days, m.return_days AS merchant_return_days,
      m.accepts_methods AS merchant_accepts_methods,
      COALESCE(c.status, 'missing') AS merchant_credential_status
    FROM products p
    JOIN merchants m ON m.id = p.merchant_id
    LEFT JOIN credentials c ON c.subject_type = 'merchant' AND c.subject_id = m.id AND c.type = 'merchant_license'
    WHERE p.status = 'published'
      AND p.stock_qty > 0
      AND (LOWER(p.name) LIKE $1 OR LOWER(p.brand) LIKE $1 OR LOWER(p.category) LIKE $1)
  `;

  const params: unknown[] = [pattern];
  let paramIdx = 2;

  if (!includeUnverified) {
    sql += ` AND c.status = 'valid'`;
  }

  if (categories && categories.length > 0) {
    sql += ` AND p.category = ANY($${paramIdx})`;
    params.push(categories);
    paramIdx++;
  }

  sql += ` ORDER BY p.price_minor ASC LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await tx.query(sql, params);
  return result.rows as unknown as ProductRow[];
}

const PRODUCT_COLUMNS = `
  p.id, p.merchant_id, p.sku, p.name, p.brand, p.category, p.spec, p.description,
  p.price_minor, p.ref_price_minor, p.stock_qty, p.risk_tags, p.image_url,
  m.name AS merchant_name, m.registered_at AS merchant_registered_at,
  m.shipping_fee_minor AS merchant_shipping_fee_minor,
  m.free_shipping_over_minor AS merchant_free_shipping_over_minor,
  m.delivery_days AS merchant_delivery_days, m.return_days AS merchant_return_days,
  m.accepts_methods AS merchant_accepts_methods,
  COALESCE(c.status, 'missing') AS merchant_credential_status
`;

/** 按 id 取一件仍在售的商品，供用户点选后重新报价。 */
export async function getProductByIdTx(tx: Tx, id: string): Promise<ProductRow | null> {
  const result = await tx.query(
    `SELECT ${PRODUCT_COLUMNS}
     FROM products p
     JOIN merchants m ON m.id = p.merchant_id
     LEFT JOIN credentials c ON c.subject_type = 'merchant' AND c.subject_id = m.id AND c.type = 'merchant_license'
     WHERE p.id = $1 AND p.status = 'published' AND p.stock_qty > 0`,
    [id],
  );
  return (result.rows[0] as unknown as ProductRow | undefined) ?? null;
}
