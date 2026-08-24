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

CREATE TABLE IF NOT EXISTS events_v2 (
  calendar_key TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_registrations_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_event_regs_source_date
  ON event_registrations_v2(source_id, event_date);

CREATE INDEX IF NOT EXISTS idx_event_regs_user
  ON event_registrations_v2(user_id, created_at);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS management_records (
  id TEXT PRIMARY KEY,
  customer_user_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_management_type_status
  ON management_records(record_type, status);

CREATE INDEX IF NOT EXISTS idx_management_due_date
  ON management_records(due_date);

CREATE INDEX IF NOT EXISTS idx_management_customer_user
  ON management_records(customer_user_id, updated_at);

CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  preferred_name TEXT,
  phone TEXT,
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'deactivated', 'merged')),
  deactivated_at TEXT,
  deactivated_by TEXT,
  merged_into_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_email
  ON customer_profiles(lower(email));

CREATE INDEX IF NOT EXISTS idx_customer_profiles_status
  ON customer_profiles(account_status, updated_at);

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

CREATE TABLE IF NOT EXISTS funnel_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'training_course_view',
    'training_cta_click',
    'training_sticky_cta_click',
    'training_sticky_cta_dismiss',
    'training_internal_progression_click',
    'training_inquiry_form_start',
    'training_inquiry_submit_attempt',
    'training_inquiry_completed',
    'training_inquiry_form_abandoned'
  )),
  session_id TEXT NOT NULL,
  site_environment TEXT NOT NULL CHECK (site_environment IN ('live', 'dev', 'local', 'preview', 'unknown')),
  page_path TEXT NOT NULL,
  course TEXT,
  device TEXT CHECK (device IS NULL OR device IN ('mobile', 'desktop')),
  source TEXT,
  medium TEXT,
  campaign TEXT,
  content TEXT,
  cta_type TEXT CHECK (cta_type IS NULL OR cta_type IN ('primary', 'secondary')),
  label TEXT,
  placement TEXT,
  destination_path TEXT,
  source_page TEXT,
  experience TEXT,
  group_type TEXT,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_funnel_events_received_at
  ON funnel_events(received_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_type_received
  ON funnel_events(event_type, received_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_session_received
  ON funnel_events(session_id, received_at);
