-- Migration: Add event visibility and friend visibility settings
-- Enables users to set events as private/friends/public and control friend event viewing

-- Add visibility column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';

ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS check_event_visibility;

ALTER TABLE public.events
ADD CONSTRAINT check_event_visibility CHECK (visibility IN ('private', 'friends', 'public'));

-- Create index for efficient visibility queries
CREATE INDEX IF NOT EXISTS idx_events_visibility ON public.events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_user_visibility ON public.events(user_id, visibility);

-- Create user_friend_visibility_settings table
-- Allows users to toggle whether they see specific friends' events
CREATE TABLE IF NOT EXISTS public.user_friend_visibility_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_events BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_visibility_setting UNIQUE (user_id, friend_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_visibility_settings_user ON public.user_friend_visibility_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_visibility_settings_friend ON public.user_friend_visibility_settings(friend_id);

-- Enable RLS
ALTER TABLE public.user_friend_visibility_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visibility settings
DROP POLICY IF EXISTS "Users can view own visibility settings" ON public.user_friend_visibility_settings;
CREATE POLICY "Users can view own visibility settings" ON public.user_friend_visibility_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own visibility settings" ON public.user_friend_visibility_settings;
CREATE POLICY "Users can manage own visibility settings" ON public.user_friend_visibility_settings
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to visibility settings" ON public.user_friend_visibility_settings;
CREATE POLICY "Service role full access to visibility settings" ON public.user_friend_visibility_settings
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Update events RLS policy to allow viewing friends' public/friends events
-- First, drop any existing friend visibility policy
DROP POLICY IF EXISTS "Users can view friends public events" ON public.events;

-- Create new policy for viewing friends' events
-- Users can see events where:
-- 1. They own the event (existing behavior)
-- 2. OR the event is friends/public AND the owner is an accepted friend AND user hasn't opted out
CREATE POLICY "Users can view friends public events" ON public.events
  FOR SELECT USING (
    -- User owns the event
    auth.uid() = user_id
    OR
    -- OR event is visible to friends/public and user is a friend who hasn't opted out
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

-- Helper function: Get friends' events for a user (respects visibility settings)
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
  aspect TEXT,
  aspect_id UUID,
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
    e.aspect,
    e.aspect_id,
    p.display_name as owner_display_name,
    p.avatar_url as owner_avatar_url,
    e.created_at
  FROM public.events e
  JOIN public.profile p ON p.id = e.user_id
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
