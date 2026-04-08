-- Add full-text search capability to notes

-- Add generated tsvector column for full-text search
ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_notes_search_vector ON notes USING GIN(search_vector);

-- RPC function for full-text search across note title and content
CREATE OR REPLACE FUNCTION search_notes_fulltext(p_user_id UUID, p_query TEXT)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'id', n.id,
    'title', n.title,
    'content', n.content,
    'aspect_id', n.aspect_id,
    'aspect_color', a.color,
    'aspect_name', a.name,
    'updated_at', n.updated_at,
    'rank', ts_rank(n.search_vector, websearch_to_tsquery('english', p_query))
  ) ORDER BY ts_rank(n.search_vector, websearch_to_tsquery('english', p_query)) DESC), '[]'::json)
  FROM notes n
  LEFT JOIN aspects a ON n.aspect_id = a.id
  WHERE n.user_id = p_user_id
    AND n.status != 'archived'
    AND (
      n.search_vector @@ websearch_to_tsquery('english', p_query)
      OR n.title ILIKE '%' || p_query || '%'
    )
  LIMIT 30;
$$;
