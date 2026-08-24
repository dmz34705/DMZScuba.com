CREATE TABLE IF NOT EXISTS event_registrations_v2 (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  cert_level TEXT NOT NULL,
  additional_guests INTEGER NOT NULL DEFAULT 0,
  party_size INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS management_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  owner TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  due_date TEXT,
  related_event TEXT,
  notes TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE event_registrations_v2 ADD COLUMN user_id TEXT;
ALTER TABLE management_records ADD COLUMN customer_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_event_regs_user
  ON event_registrations_v2(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_management_customer_user
  ON management_records(customer_user_id, updated_at);

CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  preferred_name TEXT,
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_email
  ON customer_profiles(lower(email));

CREATE TABLE IF NOT EXISTS customer_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'instructor', 'staff', 'admin')),
  created_at TEXT NOT NULL,
  created_by TEXT,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS customer_certifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agency TEXT NOT NULL,
  certification_name TEXT NOT NULL,
  certification_number TEXT,
  issued_on TEXT,
  expires_on TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_certifications_user
  ON customer_certifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS customer_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reservation_type TEXT NOT NULL CHECK (reservation_type IN ('event', 'class', 'trip', 'booking')),
  source_id TEXT,
  source_registration_id TEXT,
  event_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  party_size INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_reservations_user
  ON customer_reservations(user_id, created_at);

CREATE TABLE IF NOT EXISTS customer_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_name TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_user
  ON customer_documents(user_id, created_at);

CREATE TABLE IF NOT EXISTS customer_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_audit_user
  ON customer_audit_log(user_id, created_at);
