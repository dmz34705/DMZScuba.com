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
