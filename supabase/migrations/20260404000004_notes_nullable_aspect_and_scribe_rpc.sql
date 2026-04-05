-- Make aspect_id nullable on notes (notes can exist without an aspect, connected via links only)
ALTER TABLE notes ALTER COLUMN aspect_id DROP NOT NULL;

-- Update get_notes_with_aspects to include scribe notes, return source, and LEFT JOIN aspects
DROP FUNCTION IF EXISTS get_notes_with_aspects(UUID);

CREATE OR REPLACE FUNCTION get_notes_with_aspects(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  horizon_start TIMESTAMPTZ,
  horizon_end TIMESTAMPTZ,
  status TEXT,
  aspect_id UUID,
  aspect_name TEXT,
  aspect_color TEXT,
  aspect_icon TEXT,
  source TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.user_id,
    n.title,
    n.content,
    n.horizon_start,
    n.horizon_end,
    n.status,
    n.aspect_id,
    a.name AS aspect_name,
    a.color AS aspect_color,
    a.icon AS aspect_icon,
    n.source,
    n.created_at,
    n.updated_at
  FROM notes n
  LEFT JOIN aspects a ON a.id = n.aspect_id
  WHERE n.user_id = p_user_id
    AND n.status IN ('active', 'scribe', 'draft')
  ORDER BY n.updated_at DESC;
$$;
