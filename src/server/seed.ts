// 种子与演示重置。幂等：重复运行结果一致。
// 演示账号 alex@demo.hk / demo1234，钱包 $1,500（FUNDING journal，treasury → buyer）。
import bcrypt from "bcryptjs";
import type { Tx } from "./db/tx";
import { loadCatalog, loadRates } from "./fixtures";

export const DEMO_EMAIL = "alex@demo.hk";
export const DEMO_PASSWORD = "demo1234";
export const DEMO_NAME = "Alex";
export const DEMO_WALLET_MINOR = 150_000n;

export async function seedReference(tx: Tx) {
  const catalog = loadCatalog();
  const rates = loadRates();

  for (const m of rates.methods) {
    await tx.query(
      `INSERT INTO payment_methods (id, label, network, consumer_fee_minor, settlement, rewards, source_url, notes, observed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label, network=EXCLUDED.network,
         consumer_fee_minor=EXCLUDED.consumer_fee_minor, settlement=EXCLUDED.settlement, rewards=EXCLUDED.rewards,
         source_url=EXCLUDED.source_url, notes=EXCLUDED.notes, observed_at=EXCLUDED.observed_at`,
      [m.id, m.label, m.network, m.consumerFeeMinor, m.settlement, m.rewards ? JSON.stringify(m.rewards) : null, m.sourceUrl, m.notes, rates.observedAt],
    );
  }

  for (const m of catalog.merchants) {
    await tx.query(
      `INSERT INTO merchants (id, name, registered_at, shipping_fee_minor, free_shipping_over_minor, delivery_days, return_days, accepts_methods)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, registered_at=EXCLUDED.registered_at,
         shipping_fee_minor=EXCLUDED.shipping_fee_minor, free_shipping_over_minor=EXCLUDED.free_shipping_over_minor,
         delivery_days=EXCLUDED.delivery_days, return_days=EXCLUDED.return_days, accepts_methods=EXCLUDED.accepts_methods`,
      [m.id, m.name, m.registeredAt, m.shippingFeeMinor, m.freeShippingOverMinor, m.deliveryDays, m.returnDays, m.acceptsMethods],
    );
    await tx.query(
      `INSERT INTO credentials (subject_type, subject_id, type, issuer, status, revoked_at)
       VALUES ('merchant', $1, 'merchant_license', 'MockTrustAuthority', $2, $3)
       ON CONFLICT (subject_type, subject_id, type) DO UPDATE SET status=EXCLUDED.status, revoked_at=EXCLUDED.revoked_at`,
      [m.id, m.credentialStatus, m.credentialStatus === "revoked" ? new Date() : null],
    );
    await tx.query(
      `INSERT INTO accounts (owner_type, owner_id, balance_minor) VALUES ('merchant', $1, 0)
       ON CONFLICT (owner_type, owner_id) DO NOTHING`,
      [m.id],
    );
  }

  for (const p of catalog.products) {
    await tx.query(
      `INSERT INTO products (id, merchant_id, sku, name, brand, category, spec, description, price_minor, ref_price_minor, stock_qty, status, risk_tags, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET merchant_id=EXCLUDED.merchant_id, sku=EXCLUDED.sku, name=EXCLUDED.name, brand=EXCLUDED.brand,
         category=EXCLUDED.category, spec=EXCLUDED.spec, description=EXCLUDED.description, price_minor=EXCLUDED.price_minor,
         ref_price_minor=EXCLUDED.ref_price_minor, stock_qty=EXCLUDED.stock_qty, status=EXCLUDED.status,
         risk_tags=EXCLUDED.risk_tags, image_url=EXCLUDED.image_url`,
      [p.id, p.merchantId, p.sku, p.name, p.brand, p.category, JSON.stringify(p.spec), p.description, p.priceMinor, p.refPriceMinor, p.stockQty, p.status, p.riskTags, p.imageUrl],
    );
  }

  await tx.query(
    `INSERT INTO accounts (owner_type, owner_id, balance_minor) VALUES ('treasury', 'main', 0), ('fee', 'main', 0)
     ON CONFLICT (owner_type, owner_id) DO NOTHING`,
  );

  return { merchants: catalog.merchants.length, products: catalog.products.length, methods: rates.methods.length };
}

export async function seedDemoUser(tx: Tx): Promise<string> {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const u = await tx.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET display_name=EXCLUDED.display_name
     RETURNING id`,
    [DEMO_EMAIL, hash, DEMO_NAME],
  );
  const userId = u.rows[0].id;

  await tx.query(
    `INSERT INTO credentials (subject_type, subject_id, type, issuer, status)
     VALUES ('buyer', $1, 'agentic_id', 'MockTrustAuthority', 'valid')
     ON CONFLICT (subject_type, subject_id, type) DO UPDATE SET status='valid', revoked_at=NULL`,
    [userId],
  );

  const rates = loadRates();
  for (const m of rates.methods) {
    await tx.query(
      `INSERT INTO user_payment_methods (user_id, method_id, enabled) VALUES ($1,$2,true)
       ON CONFLICT (user_id, method_id) DO UPDATE SET enabled=true`,
      [userId, m.id],
    );
  }

  await tx.query(
    `INSERT INTO accounts (owner_type, owner_id, balance_minor) VALUES ('buyer', $1, 0)
     ON CONFLICT (owner_type, owner_id) DO NOTHING`,
    [userId],
  );

  // 初始资金：仅当买家账户尚无 FUNDING 记录时注入
  const funded = await tx.query(
    `SELECT 1 FROM journals j JOIN ledger_entries e ON e.journal_id = j.id
     JOIN accounts a ON a.id = e.account_id
     WHERE j.type='FUNDING' AND a.owner_type='buyer' AND a.owner_id=$1 LIMIT 1`,
    [userId],
  );
  if (!funded.rowCount) await postFunding(tx, userId, DEMO_WALLET_MINOR, "demo initial funding");

  return userId;
}

export async function postFunding(tx: Tx, userId: string, amountMinor: bigint, memo: string) {
  const j = await tx.query<{ id: string }>(`INSERT INTO journals (type, memo) VALUES ('FUNDING', $1) RETURNING id`, [memo]);
  const journalId = j.rows[0].id;
  const amt = amountMinor.toString();
  await tx.query(
    `INSERT INTO ledger_entries (journal_id, account_id, amount_minor)
     SELECT $1, id, -$2::bigint FROM accounts WHERE owner_type='treasury' AND owner_id='main'`,
    [journalId, amt],
  );
  await tx.query(
    `INSERT INTO ledger_entries (journal_id, account_id, amount_minor)
     SELECT $1, id, $2::bigint FROM accounts WHERE owner_type='buyer' AND owner_id=$3`,
    [journalId, amt, userId],
  );
  await tx.query(`UPDATE accounts SET balance_minor = balance_minor - $1::bigint WHERE owner_type='treasury' AND owner_id='main'`, [amt]);
  await tx.query(`UPDATE accounts SET balance_minor = balance_minor + $1::bigint WHERE owner_type='buyer' AND owner_id=$2`, [amt, userId]);
}

/** 演示重置：清掉所有交易数据，保留用户与参考数据，重新注资、重置库存与凭证。 */
export async function resetDemo(tx: Tx) {
  await tx.query(`
    TRUNCATE TABLE
      support_requests, payment_attempts, orders, confirmations, decisions,
      cart_versions, carts, agent_runs, tasks, mandate_events, mandates,
      ledger_entries, journals, audit_events
    RESTART IDENTITY CASCADE
  `);
  await tx.query(`UPDATE accounts SET balance_minor = 0`);
  await seedReference(tx); // 恢复库存、凭证状态
  const userId = await seedDemoUser(tx); // 重新注资
  return userId;
}
