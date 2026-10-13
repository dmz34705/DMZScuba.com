-- Add cross-device trip-planner records while preserving every existing account record.
CREATE TABLE sync_records_next (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('dive','computerLog','gear','setup','plan','preferences')),
  id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  mutation_id TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, kind, id)
);
INSERT INTO sync_records_next SELECT * FROM sync_records;
DROP TABLE sync_records;
ALTER TABLE sync_records_next RENAME TO sync_records;
CREATE INDEX sync_records_owner ON sync_records(user_id, kind, id);
