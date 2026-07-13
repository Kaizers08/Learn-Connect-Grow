// Script to create calendar_events table in Supabase
const https = require('https');

// Supabase configuration from .env
const SUPABASE_URL = 'https://wblacddvxokokjcwnnrm.supabase.co';
const SUPABASE_SECRET_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibGFjZGR2eG9rb2tqY3dubnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzQ2ODU0OSwiZXhwIjoyMDQ5MDQ0NTQ5fQ.FZKhxLpEWE4dN3CnLb7vW-G7YsVDL_E91gj6mUqrHK8';

const SQL = `
-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  place TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  members TEXT[],
  notes TEXT,
  color TEXT NOT NULL DEFAULT '#29CC39',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_date ON calendar_events(event_date);

-- Enable Row Level Security (RLS)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own events
CREATE POLICY "Users can view their own calendar events"
  ON calendar_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own events
CREATE POLICY "Users can insert their own calendar events"
  ON calendar_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own events
CREATE POLICY "Users can update their own calendar events"
  ON calendar_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own events
CREATE POLICY "Users can delete their own calendar events"
  ON calendar_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS \$\$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_calendar_events_updated_at_trigger
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();
`;

const data = JSON.stringify({ query: SQL });

const options = {
  hostname: 'wblacddvxokokjcwnnrm.supabase.co',
  port: 443,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SECRET_KEY,
    'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`
  }
};

console.log('Creating calendar_events table in Supabase...\n');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ SUCCESS! Calendar events table created successfully!\n');
      console.log('The table includes:');
      console.log('  - calendar_events table with all required columns');
      console.log('  - Row Level Security (RLS) policies');
      console.log('  - Indexes for performance');
      console.log('  - Auto-update timestamp triggers\n');
      console.log('You can now create calendar events that will persist in the database!');
    } else {
      console.log('❌ Error creating table. Status:', res.statusCode);
      console.log('Response:', responseData);
      console.log('\n📝 Please run the SQL manually in Supabase Dashboard:');
      console.log('   1. Go to: https://supabase.com/dashboard');
      console.log('   2. Select your project');
      console.log('   3. Click "SQL Editor" → "New Query"');
      console.log('   4. Copy contents from: supabase_calendar_events_table.sql');
      console.log('   5. Click "Run"');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('\n📝 Please run the SQL manually in Supabase Dashboard:');
  console.log('   1. Go to: https://supabase.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Click "SQL Editor" → "New Query"');
  console.log('   4. Copy contents from: supabase_calendar_events_table.sql');
  console.log('   5. Click "Run"');
});

req.write(data);
req.end();
