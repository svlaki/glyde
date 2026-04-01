-- Add reminder_minutes to get_events_with_aspects RPC function
-- Fix: reminder_minutes was being saved to the events table but never returned
-- because the RPC function didn't include it in RETURNS TABLE or SELECT

DROP FUNCTION IF EXISTS get_events_with_aspects(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE FUNCTION get_events_with_aspects(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  aspect_id UUID,
  aspect_name TEXT,
  aspect_color TEXT,
  aspect_icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  recurrence_end TIMESTAMPTZ,
  parent_event_id UUID,
  is_recurring BOOLEAN,
  visibility TEXT,
  is_shared BOOLEAN,
  reflection TEXT,
  is_missed BOOLEAN,
  project_id UUID,
  reminder_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    e.title,
    e.description,
    e.start_time,
    e.end_time,
    e.location,
    e.aspect_id,
    a.name as aspect_name,
    a.color as aspect_color,
    a.icon as aspect_icon,
    e.created_at,
    e.updated_at,
    e.recurrence_rule,
    e.recurrence_end,
    e.parent_event_id,
    e.is_recurring,
    e.visibility,
    FALSE as is_shared,
    e.reflection,
    COALESCE(e.is_missed, FALSE) as is_missed,
    e.project_id,
    e.reminder_minutes
  FROM public.events e
  LEFT JOIN public.aspects a ON e.aspect_id = a.id
  WHERE e.user_id = p_user_id
    AND e.parent_event_id IS NULL
    AND (
      (COALESCE(e.is_recurring, FALSE) = FALSE AND
       (p_start_date IS NULL OR e.start_time >= p_start_date) AND
       (p_end_date IS NULL OR e.end_time <= p_end_date))
      OR
      (e.is_recurring = TRUE AND
       e.start_time <= COALESCE(p_end_date, NOW() + INTERVAL '1 year') AND
       (e.recurrence_end IS NULL OR e.recurrence_end >= COALESCE(p_start_date, NOW() - INTERVAL '1 year')))
    )
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_events_with_aspects(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_with_aspects(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
