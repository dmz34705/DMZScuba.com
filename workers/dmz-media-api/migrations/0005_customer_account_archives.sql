CREATE TABLE IF NOT EXISTS customer_account_archives (
  id TEXT PRIMARY KEY,
  original_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  preferred_name TEXT,
  archived_at TEXT NOT NULL,
  archived_by TEXT NOT NULL,
  archived_reason TEXT,
  auth_deleted_at TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL DEFAULT 1,
  snapshot_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_account_archives_email
  ON customer_account_archives(lower(email));

CREATE INDEX IF NOT EXISTS idx_customer_account_archives_date
  ON customer_account_archives(archived_at DESC);
