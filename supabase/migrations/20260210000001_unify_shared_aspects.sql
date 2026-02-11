-- Migration: Unify shared aspects into the existing aspects table
-- Instead of a separate shared_aspects table, aspects get a visibility column
-- and sharing is handled via an aspect_members junction table.

-- 0. Clean up orphaned old tables from partial migration
DROP TABLE IF EXISTS public.shared_aspect_members CASCADE;
DROP TABLE IF EXISTS public.shared_aspects CASCADE;

-- 1. Add visibility column to aspects
ALTER TABLE public.aspects
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
CHECK (visibility IN ('private', 'shared'));

CREATE INDEX IF NOT EXISTS idx_aspects_visibility ON public.aspects(visibility);

-- 2. Create aspect_members table (references aspects.id directly)
CREATE TABLE IF NOT EXISTS public.aspect_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aspect_id UUID NOT NULL REFERENCES public.aspects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_aspect_member_v2 UNIQUE (aspect_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_aspect_members_aspect ON public.aspect_members(aspect_id);
CREATE INDEX IF NOT EXISTS idx_aspect_members_user ON public.aspect_members(user_id);
CREATE INDEX IF NOT EXISTS idx_aspect_members_role ON public.aspect_members(role);

-- 3. Enable RLS on aspect_members
ALTER TABLE public.aspect_members ENABLE ROW LEVEL SECURITY;

-- 4. Fix the SELECT policy on aspects (old one references non-existent shared_aspect_members)
DROP POLICY IF EXISTS "Users can view own and shared aspects" ON public.aspects;
CREATE POLICY "Users can view own and shared aspects" ON public.aspects
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.aspect_members am
      WHERE am.aspect_id = aspects.id
        AND am.user_id = auth.uid()
    )
  );

-- 5. RLS Policies for aspect_members

-- Users can view members of aspects they own or are a member of
DROP POLICY IF EXISTS "Users can view aspect members" ON public.aspect_members;
CREATE POLICY "Users can view aspect members" ON public.aspect_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.aspects a
      WHERE a.id = aspect_members.aspect_id
        AND (a.user_id = auth.uid() OR
             EXISTS (SELECT 1 FROM public.aspect_members am2
                     WHERE am2.aspect_id = a.id AND am2.user_id = auth.uid()))
    )
  );

-- Owners and editors can add members
DROP POLICY IF EXISTS "Owners and editors can add aspect members" ON public.aspect_members;
CREATE POLICY "Owners and editors can add aspect members" ON public.aspect_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.aspects a
      WHERE a.id = aspect_id
        AND (a.user_id = auth.uid() OR
             EXISTS (SELECT 1 FROM public.aspect_members am
                     WHERE am.aspect_id = a.id
                       AND am.user_id = auth.uid()
                       AND am.role IN ('owner', 'editor')))
    )
  );

-- Only owners can modify member roles
DROP POLICY IF EXISTS "Owners can modify aspect members" ON public.aspect_members;
CREATE POLICY "Owners can modify aspect members" ON public.aspect_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.aspects a
      WHERE a.id = aspect_id AND a.user_id = auth.uid()
    )
  );

-- Only owners can remove members
DROP POLICY IF EXISTS "Owners can remove aspect members" ON public.aspect_members;
CREATE POLICY "Owners can remove aspect members" ON public.aspect_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.aspects a
      WHERE a.id = aspect_id AND a.user_id = auth.uid()
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to aspect members" ON public.aspect_members;
CREATE POLICY "Service role full access to aspect members" ON public.aspect_members
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 6. Helper function: Get user's shared aspects with their role
CREATE OR REPLACE FUNCTION get_user_shared_aspects(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  color TEXT,
  icon TEXT,
  owner_id UUID,
  owner_display_name TEXT,
  user_role TEXT,
  member_count INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.color,
    a.icon,
    a.user_id as owner_id,
    p.display_name as owner_display_name,
    am.role as user_role,
    (SELECT COUNT(*)::INTEGER FROM public.aspect_members WHERE aspect_id = a.id) as member_count,
    a.created_at
  FROM public.aspects a
  JOIN public.aspect_members am ON am.aspect_id = a.id AND am.user_id = p_user_id
  JOIN public.profile p ON p.id = a.user_id
  WHERE a.visibility = 'shared'
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper function: Check if user can edit a shared aspect
CREATE OR REPLACE FUNCTION can_edit_aspect(p_user_id UUID, p_aspect_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.aspect_members
    WHERE aspect_id = p_aspect_id
      AND user_id = p_user_id
      AND role IN ('owner', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
