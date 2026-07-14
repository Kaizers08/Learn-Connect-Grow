-- Allow mentees to view calendar events from their connected mentors
-- This adds the missing policy for viewing connected mentors' events

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Mentees can view connected mentors calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Mentors can view connected mentees calendar events" ON calendar_events;

-- Policy: Mentees can see events from their connected mentors
CREATE POLICY "Mentees can view connected mentors calendar events"
ON calendar_events
FOR SELECT
USING (
  user_id IN (
    SELECT mentor_user_id 
    FROM connections 
    WHERE mentee_user_id = auth.uid() 
    AND status = 'connected'
  )
);

-- Policy: Mentors can see events from their connected mentees (optional)
CREATE POLICY "Mentors can view connected mentees calendar events"
ON calendar_events
FOR SELECT
USING (
  user_id IN (
    SELECT mentee_user_id 
    FROM connections 
    WHERE mentor_user_id = auth.uid() 
    AND status = 'connected'
  )
);
