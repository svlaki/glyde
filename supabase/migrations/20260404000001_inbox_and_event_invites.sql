-- Inbox system: event invite flow + role rename (editor→member) + get_events_with_aspects user_role
-- 1. Add status to event_members for invitation flow
-- 2. Rename 'editor' role to 'member' in event_members and aspect_members
-- 3. Update get_events_with_aspects to return user_role and filter by accepted status
-- 4. Update events RLS to only allow accepted members
-- 5. Update get_friends_events to exclude events where user is already a member

-- ============================================================================
-- 1. event_members: add status column for invitation flow
-- ============================================================================
ALTER TABLE public.event_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_members_status_check' AND conrelid = 'public.event_members'::regclass) THEN
    ALTER TABLE public.event_members ADD CONSTRAINT event_members_status_check CHECK (status IN ('pending', 'accepted', 'declined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_members_user_status
  ON public.event_members(user_id, status);

-- ============================================================================
-- 2. Rename 'editor' role to 'member' in both event_members and aspect_members
-- ============================================================================

-- event_members: DROP constraint FIRST, then migrate rows, then re-add
ALTER TABLE public.event_members DROP CONSTRAINT IF EXISTS event_members_role_check;
UPDATE public.event_members SET role = 'member' WHERE role = 'editor';
ALTER TABLE public.event_members
  ADD CONSTRAINT event_members_role_check CHECK (role IN ('owner', 'member', 'viewer'));

-- aspect_members: DROP constraint FIRST, then migrate rows, then re-add
ALTER TABLE public.aspect_members DROP CONSTRAINT IF EXISTS aspect_members_role_check;
ALTER TABLE public.aspect_members DROP CONSTRAINT IF EXISTS "aspect_members_role_check1";
UPDATE public.aspect_members SET role = 'member' WHERE role = 'editor';
ALTER TABLE public.aspect_members
  ADD CONSTRAINT aspect_members_role_check CHECK (role IN ('owner', 'member', 'viewer'));

-- ============================================================================
-- 3. Update get_events_with_aspects to return user_role and filter accepted
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
  user_role TEXT,
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
    -- Return actual role from event_members, or 'owner' if user owns it
    COALESCE(em.role, 'owner') as user_role,
    e.reflection,
    COALESCE(e.is_missed, FALSE) as is_missed,
    e.project_id
  FROM public.events e
  LEFT JOIN public.aspects a ON e.aspect_id = a.id
  LEFT JOIN public.event_members em
    ON em.event_id = e.id AND em.user_id = p_user_id
  WHERE
    (
      -- User's own events
      e.user_id = p_user_id
      OR
      -- Events shared with user via event_members (accepted only)
      EXISTS (
        SELECT 1 FROM public.event_members em2
        WHERE em2.event_id = e.id
          AND em2.user_id = p_user_id
          AND em2.status = 'accepted'
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

-- ============================================================================
-- 4. Update events RLS: only accepted members get access
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own shared and friend events" ON public.events;

CREATE POLICY "Users can view own shared and friend events" ON public.events
  FOR SELECT USING (
    -- User owns the event
    auth.uid() = user_id
    OR
    -- User is an accepted member of the event
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = events.id
        AND em.user_id = auth.uid()
        AND em.status = 'accepted'
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
-- 5. Update get_friends_events: exclude events where user is already a member
-- ============================================================================
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
    -- Exclude events where user is already a member (they come through get_events_with_aspects)
    AND NOT EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = e.id
        AND em.user_id = p_user_id
        AND em.status = 'accepted'
    )
    AND (p_start_date IS NULL OR e.start_time >= p_start_date)
    AND (p_end_date IS NULL OR e.end_time <= p_end_date)
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_friends_events(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_events(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ============================================================================
-- 6. Update can_edit_aspect to use 'member' role
-- ============================================================================
DROP FUNCTION IF EXISTS can_edit_aspect(UUID, UUID);

CREATE FUNCTION can_edit_aspect(p_user_id UUID, p_aspect_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.aspects WHERE id = p_aspect_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.aspect_members
    WHERE aspect_id = p_aspect_id AND user_id = p_user_id AND role IN ('owner', 'member')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
