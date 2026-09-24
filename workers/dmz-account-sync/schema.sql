-- Dedicated development database. Never apply to dmz_media.
CREATE TABLE IF NOT EXISTS sync_records (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('dive','computerLog','gear','setup','preferences')),
  id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  mutation_id TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, kind, id)
);
CREATE INDEX IF NOT EXISTS sync_records_owner ON sync_records(user_id, kind, id);
