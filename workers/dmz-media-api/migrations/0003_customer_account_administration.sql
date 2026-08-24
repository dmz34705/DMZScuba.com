ALTER TABLE customer_profiles ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'deactivated', 'merged'));
ALTER TABLE customer_profiles ADD COLUMN deactivated_at TEXT;
ALTER TABLE customer_profiles ADD COLUMN deactivated_by TEXT;
ALTER TABLE customer_profiles ADD COLUMN merged_into_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_status
  ON customer_profiles(account_status, updated_at);
