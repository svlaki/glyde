-- Fix get_events_with_categories to properly include recurring events
-- The previous version filtered by start_time >= p_start_date, which excluded
-- recurring events whose original start date was before the query window.
-- This meant recurring events created in January wouldn't show instances in February.

DROP FUNCTION IF EXISTS get_events_with_categories(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE FUNCTION get_events_with_categories(
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
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  category_icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  recurrence_end TIMESTAMPTZ,
  parent_event_id UUID,
  is_recurring BOOLEAN
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
    e.category_id,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon,
    e.created_at,
    e.updated_at,
    e.recurrence_rule,
    e.recurrence_end,
    e.parent_event_id,
    e.is_recurring
  FROM public.events e
  LEFT JOIN public.categories c ON e.category_id = c.id
  WHERE e.user_id = p_user_id
    AND e.parent_event_id IS NULL  -- Only get parent/master events, not persisted instances
    AND (
      -- Non-recurring events: use normal date range filter
      (COALESCE(e.is_recurring, FALSE) = FALSE AND
       (p_start_date IS NULL OR e.start_time >= p_start_date) AND
       (p_end_date IS NULL OR e.end_time <= p_end_date))
      OR
      -- Recurring events: include if they COULD have instances in the range
      -- A recurring event is included if:
      -- 1. Its start_time is before or at the end of the query range (could have started by then)
      -- 2. Its recurrence_end is null (infinite) OR after the start of the query range
      (e.is_recurring = TRUE AND
       e.start_time <= COALESCE(p_end_date, NOW() + INTERVAL '1 year') AND
       (e.recurrence_end IS NULL OR e.recurrence_end >= COALESCE(p_start_date, NOW() - INTERVAL '1 year')))
    )
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION get_events_with_categories(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_with_categories(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
