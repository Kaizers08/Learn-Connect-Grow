-- Add valid ID fields to mentor_profiles table
ALTER TABLE mentor_profiles
ADD COLUMN IF NOT EXISTS valid_id_type TEXT,
ADD COLUMN IF NOT EXISTS valid_id_front TEXT,
ADD COLUMN IF NOT EXISTS valid_id_back TEXT,
ADD COLUMN IF NOT EXISTS valid_id_front_scan_status TEXT DEFAULT 'unscanned',
ADD COLUMN IF NOT EXISTS valid_id_back_scan_status TEXT DEFAULT 'unscanned';

-- Add comment for documentation
COMMENT ON COLUMN mentor_profiles.valid_id_type IS 'Type of ID: drivers_license, national_id, passport, etc.';
COMMENT ON COLUMN mentor_profiles.valid_id_front IS 'Storage URL for front side of valid ID';
COMMENT ON COLUMN mentor_profiles.valid_id_back IS 'Storage URL for back side of valid ID';
COMMENT ON COLUMN mentor_profiles.valid_id_front_scan_status IS 'Security scan status: trusted, blocked, unscanned';
COMMENT ON COLUMN mentor_profiles.valid_id_back_scan_status IS 'Security scan status: trusted, blocked, unscanned';
