CREATE TABLE IF NOT EXISTS customer_app_settings (
  user_id TEXT PRIMARY KEY,
  depth_unit TEXT NOT NULL DEFAULT 'ft'
    CHECK (depth_unit IN ('ft', 'm')),
  pressure_unit TEXT NOT NULL DEFAULT 'psi'
    CHECK (pressure_unit IN ('psi', 'bar')),
  gas_volume_unit TEXT NOT NULL DEFAULT 'ft³'
    CHECK (gas_volume_unit IN ('ft³', 'L')),
  temperature_unit TEXT NOT NULL DEFAULT 'F'
    CHECK (temperature_unit IN ('F', 'C')),
  trimix_mode INTEGER NOT NULL DEFAULT 0
    CHECK (trimix_mode IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_app_settings_updated
  ON customer_app_settings(updated_at);
