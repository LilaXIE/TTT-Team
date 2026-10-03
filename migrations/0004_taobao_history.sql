-- 淘宝集成：用户隔离的登录态、查询历史和查询商品快照。
CREATE TABLE IF NOT EXISTS taobao_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_ciphertext text NOT NULL,
  state_version int NOT NULL DEFAULT 1,
  last_login_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  source text NOT NULL CHECK (source IN ('taobao','catalog','unavailable')),
  result_count int NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_history_user_idx ON search_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search_history_items (
  search_id uuid NOT NULL REFERENCES search_history(id) ON DELETE CASCADE,
  position int NOT NULL,
  item jsonb NOT NULL,
  PRIMARY KEY (search_id, position)
);

CREATE INDEX IF NOT EXISTS orders_history_user_idx ON orders(user_id, created_at DESC);
