-- 用户级下单偏好：授权表单使用签发时快照，后续修改不影响既有授权。
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  per_txn_cap_minor bigint NOT NULL DEFAULT 15000 CHECK (per_txn_cap_minor > 0),
  total_cap_minor bigint NOT NULL DEFAULT 30000 CHECK (total_cap_minor > 0),
  max_purchases int NOT NULL DEFAULT 2 CHECK (max_purchases > 0),
  review_when jsonb NOT NULL DEFAULT '{"nearCapPct":95,"substituteBrand":true,"watchCategories":["supplement"],"newMerchantDays":null,"priceAboveRefPct":null}'::jsonb,
  protection_level text NOT NULL DEFAULT 'standard' CHECK (protection_level IN ('standard','enhanced')),
  allowed_methods text[] NOT NULL DEFAULT ARRAY['fps','tapngo_mc'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
