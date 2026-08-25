ALTER TABLE booking_offerings ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (booking_mode IN ('on_demand', 'scheduled'));

UPDATE booking_offerings
SET booking_mode = 'on_demand'
WHERE starts_on IS NULL OR trim(starts_on) = '';

CREATE INDEX IF NOT EXISTS idx_booking_offerings_catalog
  ON booking_offerings(active, category, booking_mode, starts_on);
