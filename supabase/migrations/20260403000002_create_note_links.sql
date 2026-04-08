-- Note links table for wiki-link graph connections between notes
CREATE TABLE IF NOT EXISTS note_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_note_id, target_note_id),
  CHECK (source_note_id != target_note_id)
);

-- RLS
ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own note links"
  ON note_links FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for graph queries
CREATE INDEX idx_note_links_source ON note_links(source_note_id);
CREATE INDEX idx_note_links_target ON note_links(target_note_id);
CREATE INDEX idx_note_links_user ON note_links(user_id);

-- RPC function to get the full note graph for a user
CREATE OR REPLACE FUNCTION get_note_graph(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'nodes', COALESCE((
      SELECT json_agg(json_build_object(
        'id', n.id,
        'title', n.title,
        'aspect_id', n.aspect_id,
        'aspect_color', a.color,
        'aspect_name', a.name,
        'updated_at', n.updated_at
      ))
      FROM notes n
      LEFT JOIN aspects a ON n.aspect_id = a.id
      WHERE n.user_id = p_user_id AND n.status != 'archived'
    ), '[]'::json),
    'links', COALESCE((
      SELECT json_agg(json_build_object(
        'source', nl.source_note_id,
        'target', nl.target_note_id
      ))
      FROM note_links nl
      WHERE nl.user_id = p_user_id
    ), '[]'::json)
  );
$$;

-- RPC function to search notes by title (for wiki-link autocomplete)
CREATE OR REPLACE FUNCTION search_notes_by_title(p_user_id UUID, p_query TEXT)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'id', n.id,
    'title', n.title,
    'aspect_color', a.color,
    'aspect_name', a.name
  )), '[]'::json)
  FROM notes n
  LEFT JOIN aspects a ON n.aspect_id = a.id
  WHERE n.user_id = p_user_id
    AND n.status != 'archived'
    AND n.title ILIKE '%' || p_query || '%'
  ORDER BY n.updated_at DESC
  LIMIT 20;
$$;
