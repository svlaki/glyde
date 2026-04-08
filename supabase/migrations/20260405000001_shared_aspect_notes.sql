-- Make notes in shared aspects visible and editable by all aspect members
-- This matches how events already work with shared aspects

-- Drop old user-only RLS policies
DROP POLICY IF EXISTS "Users can view their own plans" ON notes;
DROP POLICY IF EXISTS "Users can create their own plans" ON notes;
DROP POLICY IF EXISTS "Users can update their own plans" ON notes;
DROP POLICY IF EXISTS "Users can delete their own plans" ON notes;

-- New policies: own notes + shared aspect notes
CREATE POLICY "Users can view own and shared aspect notes"
ON notes FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    aspect_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM aspect_members am
      WHERE am.aspect_id = notes.aspect_id
        AND am.user_id = auth.uid()
        AND am.status = 'accepted'
    )
  )
);

CREATE POLICY "Users can create notes"
ON notes FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own and shared aspect notes"
ON notes FOR UPDATE
USING (
  user_id = auth.uid()
  OR (
    aspect_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM aspect_members am
      WHERE am.aspect_id = notes.aspect_id
        AND am.user_id = auth.uid()
        AND am.status = 'accepted'
    )
  )
);

CREATE POLICY "Users can delete own notes"
ON notes FOR DELETE
USING (user_id = auth.uid());

-- Update get_notes_with_aspects to return shared notes with owner info
DROP FUNCTION IF EXISTS get_notes_with_aspects(UUID);

CREATE OR REPLACE FUNCTION get_notes_with_aspects(p_user_id UUID)
RETURNS TABLE(
  id UUID, user_id UUID, title TEXT, content TEXT,
  horizon_start TIMESTAMPTZ, horizon_end TIMESTAMPTZ, status TEXT,
  aspect_id UUID, aspect_name TEXT, aspect_color TEXT, aspect_icon TEXT,
  source TEXT, is_shared BOOLEAN, owner_display_name TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    n.id, n.user_id, n.title, n.content,
    n.horizon_start, n.horizon_end, n.status,
    n.aspect_id, a.name, a.color, a.icon,
    n.source, (n.user_id != p_user_id), p.display_name,
    n.created_at, n.updated_at
  FROM notes n
  LEFT JOIN aspects a ON a.id = n.aspect_id
  LEFT JOIN profile p ON p.id = n.user_id
  WHERE (
    n.user_id = p_user_id
    OR (n.aspect_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM aspect_members am
      WHERE am.aspect_id = n.aspect_id AND am.user_id = p_user_id AND am.status = 'accepted'
    ))
  )
  AND n.status IN ('active', 'scribe', 'draft')
  ORDER BY n.updated_at DESC;
$$;
