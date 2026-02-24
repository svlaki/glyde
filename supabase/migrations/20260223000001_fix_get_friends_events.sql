-- Fix: get_friends_events referenced non-existent column e.aspect
-- Replace with aspect data from the aspects table (matching get_events_with_aspects pattern)

DROP FUNCTION IF EXISTS get_friends_events(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_friends_events(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  description TEXT,
  visibility TEXT,
  aspect_id UUID,
  aspect_name TEXT,
  aspect_color TEXT,
  aspect_icon TEXT,
  owner_display_name TEXT,
  owner_avatar_url TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    e.title,
    e.start_time,
    e.end_time,
    e.location,
    -- Hide description for friend events (privacy)
    NULL::TEXT as description,
    e.visibility,
    e.aspect_id,
    a.name as aspect_name,
    a.color as aspect_color,
    a.icon as aspect_icon,
    p.display_name as owner_display_name,
    p.avatar_url as owner_avatar_url,
    e.created_at
  FROM public.events e
  JOIN public.profile p ON p.id = e.user_id
  LEFT JOIN public.aspects a ON e.aspect_id = a.id
  WHERE e.visibility IN ('friends', 'public')
    AND e.user_id != p_user_id
    AND are_users_friends(p_user_id, e.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_friend_visibility_settings vss
      WHERE vss.user_id = p_user_id
        AND vss.friend_id = e.user_id
        AND vss.show_events = false
    )
    AND (p_start_date IS NULL OR e.start_time >= p_start_date)
    AND (p_end_date IS NULL OR e.end_time <= p_end_date)
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_friends_events(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_events(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
