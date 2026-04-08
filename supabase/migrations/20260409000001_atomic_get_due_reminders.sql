-- Replace get_due_reminders with an atomic claim using FOR UPDATE SKIP LOCKED.
-- This prevents two worker processes from fetching the same batch of reminders.
-- Rows transition: pending/snoozed -> delivering -> delivered

DROP FUNCTION IF EXISTS get_due_reminders();

CREATE OR REPLACE FUNCTION get_due_reminders()
RETURNS SETOF reminders AS $$
  WITH due AS (
    SELECT id FROM reminders
    WHERE status IN ('pending', 'snoozed')
      AND trigger_at <= now()
    ORDER BY trigger_at
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  )
  UPDATE reminders r
  SET status = 'delivering', updated_at = now()
  FROM due
  WHERE r.id = due.id
  RETURNING r.*;
$$ LANGUAGE sql SECURITY DEFINER;
