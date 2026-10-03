-- app_1902 工作台持久化：地址、支付卡片、聊天和 SMTP 设置。
CREATE TABLE IF NOT EXISTS user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_addresses_user_idx ON user_addresses(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_default_idx ON user_addresses(user_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS user_bank_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  card_type text NOT NULL CHECK (card_type IN ('储蓄卡','信用卡')),
  last_four text NOT NULL,
  balance_minor bigint NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_bank_cards_user_idx ON user_bank_cards(user_id, created_at);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '新代购咨询',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id, id);

CREATE TABLE IF NOT EXISTS user_smtp_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sender_email text NOT NULL,
  host text NOT NULL,
  port int NOT NULL,
  use_ssl boolean NOT NULL DEFAULT true,
  password_ciphertext text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('registration','payment')),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_lookup_idx ON email_verifications(email, purpose, created_at DESC);
