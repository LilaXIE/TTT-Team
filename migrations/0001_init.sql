-- MandateWallet 初始模式。规格：docs/MANUAL.md §3.3。
-- 金额一律 BIGINT，单位：港元分。时间一律 timestamptz。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- 用户与会话 ----------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- ---------- 凭证（Trust） ----------
CREATE TABLE credentials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('buyer','merchant')),
  subject_id   text NOT NULL,
  type         text NOT NULL,
  issuer       text NOT NULL,
  status       text NOT NULL CHECK (status IN ('valid','revoked','expired')),
  issued_at    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  UNIQUE (subject_type, subject_id, type)
);

-- ---------- 商家与商品 ----------
CREATE TABLE merchants (
  id                       text PRIMARY KEY,
  name                     text NOT NULL,
  registered_at            timestamptz NOT NULL,
  shipping_fee_minor       bigint NOT NULL CHECK (shipping_fee_minor >= 0),
  free_shipping_over_minor bigint CHECK (free_shipping_over_minor IS NULL OR free_shipping_over_minor >= 0),
  delivery_days            int NOT NULL CHECK (delivery_days >= 0),
  return_days              int NOT NULL CHECK (return_days >= 0),
  accepts_methods          text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE products (
  id              text PRIMARY KEY,
  merchant_id     text NOT NULL REFERENCES merchants(id),
  sku             text NOT NULL,
  name            text NOT NULL,
  brand           text NOT NULL,
  category        text NOT NULL,
  spec            jsonb NOT NULL DEFAULT '{}'::jsonb,
  description     text NOT NULL DEFAULT '',
  price_minor     bigint NOT NULL CHECK (price_minor >= 0),
  ref_price_minor bigint NOT NULL CHECK (ref_price_minor >= 0),
  stock_qty       int NOT NULL CHECK (stock_qty >= 0),
  status          text NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft','suspended')),
  risk_tags       text[] NOT NULL DEFAULT '{}',
  image_url       text,
  UNIQUE (merchant_id, sku)
);
CREATE INDEX products_category_idx ON products(category);

-- ---------- 支付方式 ----------
CREATE TABLE payment_methods (
  id                 text PRIMARY KEY,
  label              text NOT NULL,
  network            text NOT NULL,
  consumer_fee_minor bigint NOT NULL DEFAULT 0 CHECK (consumer_fee_minor >= 0),
  settlement         text NOT NULL,
  rewards            jsonb,
  source_url         text,
  notes              text NOT NULL DEFAULT '',
  observed_at        timestamptz NOT NULL
);

CREATE TABLE user_payment_methods (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_id text NOT NULL REFERENCES payment_methods(id),
  enabled   boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, method_id)
);

-- ---------- 授权书 ----------
CREATE TABLE mandates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  version             int NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired','completed')),
  task                jsonb NOT NULL,
  scope               jsonb NOT NULL,
  caps                jsonb NOT NULL,
  review_when         jsonb NOT NULL,
  protection_level    text NOT NULL CHECK (protection_level IN ('standard','enhanced')),
  allowed_methods     text[] NOT NULL,
  per_txn_cap_minor   bigint NOT NULL CHECK (per_txn_cap_minor > 0),
  total_cap_minor     bigint NOT NULL CHECK (total_cap_minor > 0),
  remaining_minor     bigint NOT NULL CHECK (remaining_minor >= 0),
  max_purchases       int NOT NULL CHECK (max_purchases > 0),
  remaining_purchases int NOT NULL CHECK (remaining_purchases >= 0),
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz
);
CREATE INDEX mandates_user_idx ON mandates(user_id, created_at DESC);

CREATE TABLE mandate_events (
  id         bigserial PRIMARY KEY,
  mandate_id uuid NOT NULL REFERENCES mandates(id) ON DELETE CASCADE,
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mandate_events_mandate_idx ON mandate_events(mandate_id, id);

-- ---------- 任务与 Agent 运行 ----------
CREATE TABLE tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  mandate_id uuid NOT NULL REFERENCES mandates(id),
  status     text NOT NULL DEFAULT 'running'
             CHECK (status IN ('running','awaiting_confirmation','completed','failed','cancelled')),
  input_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_user_idx ON tasks(user_id, created_at DESC);

CREATE TABLE agent_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  mode       text NOT NULL CHECK (mode IN ('llm','fallback')),
  steps      jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_runs_task_idx ON agent_runs(task_id);

-- ---------- 购物车与版本快照 ----------
CREATE TABLE carts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  merchant_id     text NOT NULL REFERENCES merchants(id),
  current_version int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carts_task_idx ON carts(task_id);

CREATE TABLE cart_versions (
  cart_id            uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  version            int NOT NULL,
  items              jsonb NOT NULL,
  subtotal_minor     bigint NOT NULL CHECK (subtotal_minor >= 0),
  shipping_minor     bigint NOT NULL CHECK (shipping_minor >= 0),
  consumer_fee_minor bigint NOT NULL DEFAULT 0 CHECK (consumer_fee_minor >= 0),
  total_minor        bigint NOT NULL CHECK (total_minor >= 0),
  method_id          text NOT NULL REFERENCES payment_methods(id),
  quote_expires_at   timestamptz NOT NULL,
  hash               text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, version)
);

-- ---------- 决策与确认 ----------
CREATE TABLE decisions (
  id              bigserial PRIMARY KEY,
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  cart_id         uuid REFERENCES carts(id),
  cart_version    int,
  checkpoint      text NOT NULL CHECK (checkpoint IN ('INTENT','CANDIDATES','QUOTE','ROUTE','PAY')),
  outcome         text NOT NULL CHECK (outcome IN ('ALLOW','REVIEW','DENY')),
  rules           jsonb NOT NULL DEFAULT '[]'::jsonb,
  mandate_version int NOT NULL,
  context         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 当时的剩余额度/次数/总额/支付方式，供 /ledger 回放
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decisions_task_idx ON decisions(task_id, id);

CREATE TABLE confirmations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  cart_id      uuid NOT NULL REFERENCES carts(id),
  cart_version int NOT NULL,
  rule_ids     text[] NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX confirmations_cart_idx ON confirmations(cart_id, cart_version);

-- ---------- 订单与支付 ----------
CREATE TABLE orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks(id),
  cart_id      uuid NOT NULL REFERENCES carts(id),
  cart_version int NOT NULL,
  user_id      uuid NOT NULL REFERENCES users(id),
  merchant_id  text NOT NULL REFERENCES merchants(id),
  total_minor  bigint NOT NULL CHECK (total_minor >= 0),
  method_id    text NOT NULL REFERENCES payment_methods(id),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','declined','cancelled')),
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, cart_version)
);
CREATE INDEX orders_user_idx ON orders(user_id, created_at DESC);

CREATE TABLE payment_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  order_id        uuid REFERENCES orders(id),
  idempotency_key text NOT NULL,
  request_hash    text NOT NULL,
  status          text NOT NULL CHECK (status IN ('succeeded','failed','denied','review')),
  result          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

-- ---------- 账本（复式） ----------
CREATE TABLE accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type    text NOT NULL CHECK (owner_type IN ('buyer','merchant','treasury','fee')),
  owner_id      text NOT NULL,
  balance_minor bigint NOT NULL DEFAULT 0,
  UNIQUE (owner_type, owner_id),
  CHECK (owner_type = 'treasury' OR balance_minor >= 0)
);

CREATE TABLE journals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL CHECK (type IN ('FUNDING','SALE')),
  order_id   uuid REFERENCES orders(id),
  memo       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX journals_sale_order_uniq ON journals(order_id) WHERE type = 'SALE';

CREATE TABLE ledger_entries (
  id           bigserial PRIMARY KEY,
  journal_id   uuid NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  account_id   uuid NOT NULL REFERENCES accounts(id),
  amount_minor bigint NOT NULL,          -- 正：入账；负：出账。每个 journal 合计为 0。
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_account_idx ON ledger_entries(account_id, id);
CREATE INDEX ledger_entries_journal_idx ON ledger_entries(journal_id);

-- ---------- 售后与审计 ----------
CREATE TABLE support_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id),
  type       text NOT NULL,
  reason     text NOT NULL,
  status     text NOT NULL DEFAULT 'manual_review',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id         bigserial PRIMARY KEY,
  actor      text NOT NULL,              -- 'user:<id>' | 'agent' | 'system' | 'demo'
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_idx ON audit_events(entity, entity_id, id);
