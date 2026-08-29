ALTER TABLE customer_profiles ADD COLUMN birthdate TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN address_line1 TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN address_line2 TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN address_city TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN address_region TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN address_postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_profiles ADD COLUMN address_country_code TEXT NOT NULL DEFAULT 'US';

ALTER TABLE customer_certifications ADD COLUMN agency_code TEXT NOT NULL DEFAULT 'other';
ALTER TABLE customer_certifications ADD COLUMN certification_code TEXT NOT NULL DEFAULT 'other';
ALTER TABLE customer_certifications ADD COLUMN certification_category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE customer_certifications ADD COLUMN does_not_expire INTEGER NOT NULL DEFAULT 1
  CHECK (does_not_expire IN (0, 1));
ALTER TABLE customer_certifications ADD COLUMN is_professional INTEGER NOT NULL DEFAULT 0
  CHECK (is_professional IN (0, 1));
ALTER TABLE customer_certifications ADD COLUMN professional_status TEXT NOT NULL DEFAULT ''
  CHECK (professional_status IN ('', 'active', 'inactive'));
ALTER TABLE customer_certifications ADD COLUMN professional_insurance_current INTEGER
  CHECK (professional_insurance_current IS NULL OR professional_insurance_current IN (0, 1));
ALTER TABLE customer_certifications ADD COLUMN professional_facility TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_certifications ADD COLUMN certifying_instructor TEXT NOT NULL DEFAULT '';

UPDATE customer_certifications
SET agency_code = CASE upper(trim(agency))
  WHEN 'PADI' THEN 'padi'
  WHEN 'SSI' THEN 'ssi'
  WHEN 'SDI' THEN 'sdi'
  WHEN 'TDI' THEN 'tdi'
  WHEN 'ERDI' THEN 'erdi'
  WHEN 'NAUI' THEN 'naui'
  WHEN 'RAID' THEN 'raid'
  WHEN 'GUE' THEN 'gue'
  WHEN 'IANTD' THEN 'iantd'
  WHEN 'BSAC' THEN 'bsac'
  WHEN 'CMAS' THEN 'cmas'
  ELSE 'other'
END;

UPDATE customer_certifications
SET certification_code = CASE lower(trim(certification_name))
  WHEN 'open water' THEN 'open_water'
  WHEN 'open water diver' THEN 'open_water'
  WHEN 'advanced open water' THEN 'advanced_open_water'
  WHEN 'advanced open water diver' THEN 'advanced_open_water'
  WHEN 'rescue diver' THEN 'rescue_diver'
  WHEN 'nitrox' THEN 'nitrox'
  WHEN 'nitrox diver' THEN 'nitrox'
  WHEN 'enriched air' THEN 'nitrox'
  WHEN 'enriched air diver' THEN 'nitrox'
  WHEN 'divemaster' THEN 'divemaster'
  WHEN 'dive master' THEN 'divemaster'
  WHEN 'assistant instructor' THEN 'assistant_instructor'
  WHEN 'open water instructor' THEN 'open_water_instructor'
  ELSE 'other'
END,
certification_category = CASE
  WHEN lower(trim(certification_name)) IN ('divemaster', 'dive master', 'assistant instructor', 'open water instructor') THEN 'professional'
  WHEN lower(trim(certification_name)) IN ('nitrox', 'nitrox diver', 'enriched air', 'enriched air diver') THEN 'specialty'
  WHEN lower(trim(certification_name)) IN ('open water', 'open water diver', 'advanced open water', 'advanced open water diver', 'rescue diver') THEN 'recreational'
  ELSE 'other'
END,
is_professional = CASE
  WHEN lower(trim(certification_name)) IN ('divemaster', 'dive master', 'assistant instructor', 'open water instructor') THEN 1
  ELSE 0
END,
does_not_expire = CASE WHEN expires_on IS NULL OR trim(expires_on) = '' THEN 1 ELSE 0 END;

CREATE INDEX IF NOT EXISTS idx_customer_certifications_lookup
  ON customer_certifications(user_id, certification_code, verification_status);
