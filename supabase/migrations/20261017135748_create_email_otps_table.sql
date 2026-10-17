-- Create email_otps table for storing OTP verification codes
CREATE TABLE IF NOT EXISTS email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON email_otps(expires_at);

-- Add RLS policies
ALTER TABLE email_otps ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role has full access to email_otps"
  ON email_otps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users cannot directly access OTP table (must go through Edge Functions)
CREATE POLICY "Users cannot access email_otps directly"
  ON email_otps
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Function to clean up expired OTPs (run this periodically via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM email_otps
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_otps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_otps_updated_at
  BEFORE UPDATE ON email_otps
  FOR EACH ROW
  EXECUTE FUNCTION update_email_otps_updated_at();

-- Add comment
COMMENT ON TABLE email_otps IS 'Stores email verification OTP codes with expiration and attempt tracking';
