-- Fix: Shared events (via event_members) are not visible to invited users.
-- Two issues:
-- 1. The events RLS SELECT policy only checks owner + friend visibility, not event_members
-- 2. get_events_with_aspects only queries WHERE user_id = p_user_id, missing shared events

-- ============================================================================
-- 1. Update events SELECT policy to include event_members
-- ============================================================================
DROP POLICY IF EXISTS "Users can view friends public events" ON public.events;

CREATE POLICY "Users can view own shared and friend events" ON public.events
  FOR SELECT USING (
    -- User owns the event
    auth.uid() = user_id
    OR
    -- User is a member of the event (directly shared)
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = events.id
        AND em.user_id = auth.uid()
    )
    OR
    -- Event is visible to friends/public AND user is a friend AND hasn't opted out
    (
      visibility IN ('friends', 'public')
      AND are_users_friends(auth.uid(), user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_friend_visibility_settings vss
        WHERE vss.user_id = auth.uid()
          AND vss.friend_id = events.user_id
          AND vss.show_events = false
      )
    )
  );

-- ============================================================================
-- 2. Update get_events_with_aspects to include shared events
-- ============================================================================
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
  project_id UUID
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
    -- Mark as shared if user is a member but not the owner
    (e.user_id != p_user_id) as is_shared,
    e.reflection,
    COALESCE(e.is_missed, FALSE) as is_missed,
    e.project_id
  FROM public.events e
  LEFT JOIN public.aspects a ON e.aspect_id = a.id
  WHERE
    (
      -- User's own events
      e.user_id = p_user_id
      OR
      -- Events shared with user via event_members
      EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = e.id
          AND em.user_id = p_user_id
      )
    )
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
