-- Add event_type column to calendar_events table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'calendar_events' 
    AND column_name = 'event_type'
  ) THEN
    ALTER TABLE calendar_events 
    ADD COLUMN event_type TEXT NOT NULL DEFAULT 'personal';
  END IF;
END $$;
