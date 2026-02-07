CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT,
  badge TEXT,
  thumb_text TEXT,
  url TEXT,
  thumb_url TEXT,
  stream_id TEXT,
  meta TEXT,
  location TEXT,
  sort_order INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(type);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS destinations_base (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS destinations_expanded (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  base_json TEXT NOT NULL,
  expanded_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS destinations_v2 (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
