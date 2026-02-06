-- Migration: Create shared aspects system
-- Enables group aspect sharing with owner/editor/viewer permissions

-- Create shared_aspects table
CREATE TABLE IF NOT EXISTS public.shared_aspects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shared_aspects_owner ON public.shared_aspects(owner_id);

-- Create shared_aspect_members table
CREATE TABLE IF NOT EXISTS public.shared_aspect_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aspect_id UUID NOT NULL REFERENCES public.shared_aspects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_aspect_member UNIQUE (aspect_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_aspect_members_aspect ON public.shared_aspect_members(aspect_id);
CREATE INDEX IF NOT EXISTS idx_aspect_members_user ON public.shared_aspect_members(user_id);
CREATE INDEX IF NOT EXISTS idx_aspect_members_role ON public.shared_aspect_members(role);

-- Enable RLS
ALTER TABLE public.shared_aspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_aspect_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_aspects

-- Users can view shared aspects they're members of or own
DROP POLICY IF EXISTS "Users can view shared aspects" ON public.shared_aspects;
CREATE POLICY "Users can view shared aspects" ON public.shared_aspects
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.shared_aspect_members sam
      WHERE sam.aspect_id = shared_aspects.id
        AND sam.user_id = auth.uid()
    )
  );

-- Users can create shared aspects (they become owner)
DROP POLICY IF EXISTS "Users can create shared aspects" ON public.shared_aspects;
CREATE POLICY "Users can create shared aspects" ON public.shared_aspects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Only owners can update shared aspects
DROP POLICY IF EXISTS "Owners can modify shared aspects" ON public.shared_aspects;
CREATE POLICY "Owners can modify shared aspects" ON public.shared_aspects
  FOR UPDATE USING (owner_id = auth.uid());

-- Only owners can delete shared aspects
DROP POLICY IF EXISTS "Owners can delete shared aspects" ON public.shared_aspects;
CREATE POLICY "Owners can delete shared aspects" ON public.shared_aspects
  FOR DELETE USING (owner_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to shared aspects" ON public.shared_aspects;
CREATE POLICY "Service role full access to shared aspects" ON public.shared_aspects
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for shared_aspect_members

-- Users can view members of aspects they have access to
DROP POLICY IF EXISTS "Users can view aspect members" ON public.shared_aspect_members;
CREATE POLICY "Users can view aspect members" ON public.shared_aspect_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_aspects sa
      WHERE sa.id = shared_aspect_members.aspect_id
        AND (sa.owner_id = auth.uid() OR
             EXISTS (SELECT 1 FROM public.shared_aspect_members sam2
                     WHERE sam2.aspect_id = sa.id AND sam2.user_id = auth.uid()))
    )
  );

-- Only owners and editors can add members
DROP POLICY IF EXISTS "Owners and editors can add members" ON public.shared_aspect_members;
CREATE POLICY "Owners and editors can add members" ON public.shared_aspect_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_aspects sa
      WHERE sa.id = aspect_id
        AND (sa.owner_id = auth.uid() OR
             EXISTS (SELECT 1 FROM public.shared_aspect_members sam
                     WHERE sam.aspect_id = sa.id
                       AND sam.user_id = auth.uid()
                       AND sam.role IN ('owner', 'editor')))
    )
  );

-- Only owners can modify members (change roles)
DROP POLICY IF EXISTS "Owners can modify members" ON public.shared_aspect_members;
CREATE POLICY "Owners can modify members" ON public.shared_aspect_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shared_aspects sa
      WHERE sa.id = aspect_id AND sa.owner_id = auth.uid()
    )
  );

-- Only owners can remove members
DROP POLICY IF EXISTS "Owners can remove members" ON public.shared_aspect_members;
CREATE POLICY "Owners can remove members" ON public.shared_aspect_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.shared_aspects sa
      WHERE sa.id = aspect_id AND sa.owner_id = auth.uid()
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to aspect members" ON public.shared_aspect_members;
CREATE POLICY "Service role full access to aspect members" ON public.shared_aspect_members
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Optional: Add shared_aspect_id to events table for linking events to shared aspects
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS shared_aspect_id UUID REFERENCES public.shared_aspects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_shared_aspect ON public.events(shared_aspect_id);

-- Helper function: Get user's shared aspects with their role
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
    sa.id,
    sa.name,
    sa.description,
    sa.color,
    sa.icon,
    sa.owner_id,
    p.display_name as owner_display_name,
    sam.role as user_role,
    (SELECT COUNT(*)::INTEGER FROM public.shared_aspect_members WHERE aspect_id = sa.id) as member_count,
    sa.created_at
  FROM public.shared_aspects sa
  JOIN public.shared_aspect_members sam ON sam.aspect_id = sa.id AND sam.user_id = p_user_id
  JOIN public.profile p ON p.id = sa.owner_id
  ORDER BY sa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user can edit shared aspect
CREATE OR REPLACE FUNCTION can_edit_shared_aspect(p_user_id UUID, p_aspect_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.shared_aspect_members
    WHERE aspect_id = p_aspect_id
      AND user_id = p_user_id
      AND role IN ('owner', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
