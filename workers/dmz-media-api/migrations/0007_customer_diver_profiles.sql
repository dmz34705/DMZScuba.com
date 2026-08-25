ALTER TABLE customer_profiles ADD COLUMN home_location TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN emergency_contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN emergency_contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN logged_dives INTEGER NOT NULL DEFAULT 0
  CHECK (logged_dives >= 0 AND logged_dives <= 100000);
ALTER TABLE customer_profiles ADD COLUMN default_pp_o2 REAL NOT NULL DEFAULT 1.4
  CHECK (default_pp_o2 >= 0.5 AND default_pp_o2 <= 2.0);
ALTER TABLE customer_profiles ADD COLUMN default_rmv REAL NOT NULL DEFAULT 18
  CHECK (default_rmv >= 1 AND default_rmv <= 200);
