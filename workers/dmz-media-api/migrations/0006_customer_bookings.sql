CREATE TABLE IF NOT EXISTS booking_offerings (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  source_date TEXT,
  category TEXT NOT NULL CHECK (category IN ('class', 'trip', 'event')),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_on TEXT,
  ends_on TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source_id, source_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_offerings_active
  ON booking_offerings(active, category, starts_on);

CREATE TABLE IF NOT EXISTS customer_bookings_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  offering_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('class', 'trip', 'event')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'confirmed', 'waitlisted', 'cancelled', 'completed')),
  registrant_first_name TEXT NOT NULL,
  registrant_last_name TEXT NOT NULL,
  registrant_email TEXT NOT NULL,
  registrant_phone TEXT NOT NULL,
  registrant_birthdate TEXT NOT NULL,
  is_minor INTEGER NOT NULL DEFAULT 0 CHECK (is_minor IN (0, 1)),
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('not_required', 'unpaid', 'processing', 'paid', 'refunded', 'failed')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_bookings_user
  ON customer_bookings_v2(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_bookings_offering
  ON customer_bookings_v2(offering_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_bookings_checkout
  ON customer_bookings_v2(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

