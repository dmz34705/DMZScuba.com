-- Nullable for accounts created before layouts. Old clients preserve this value.
ALTER TABLE customer_app_settings ADD COLUMN layout_json TEXT;
