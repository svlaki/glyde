-- Note templates table
CREATE TABLE IF NOT EXISTS note_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  aspect_id UUID REFERENCES aspects(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_id is NULL for system templates, NOT NULL for user-created
CREATE INDEX idx_note_templates_user ON note_templates(user_id);

-- RLS
ALTER TABLE note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own and system templates"
  ON note_templates FOR SELECT
  USING (user_id = auth.uid() OR is_system = true);

CREATE POLICY "Users can manage their own templates"
  ON note_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_note_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_note_template_timestamp
  BEFORE UPDATE ON note_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_note_template_timestamp();

-- Seed system templates
INSERT INTO note_templates (user_id, title, content, is_system) VALUES
(NULL, 'Meeting Notes', E'## Attendees\n\n- \n\n## Agenda\n\n1. \n\n## Discussion\n\n\n\n## Action Items\n\n- [ ] \n\n## Next Steps\n\n', true),
(NULL, 'Weekly Review', E'## Wins This Week\n\n- \n\n## Challenges\n\n- \n\n## Lessons Learned\n\n\n\n## Next Week Priorities\n\n1. \n2. \n3. \n\n## Notes\n\n', true),
(NULL, 'Project Brief', E'## Overview\n\n\n\n## Goals\n\n- \n\n## Scope\n\n### In Scope\n\n- \n\n### Out of Scope\n\n- \n\n## Timeline\n\n| Phase | Date | Status |\n|-------|------|--------|\n| | | |\n\n## Key Decisions\n\n\n\n## Resources\n\n', true),
(NULL, 'Daily Journal', E'## Today: {{date}}\n\n### Morning Intentions\n\n- \n\n### Gratitude\n\n1. \n2. \n3. \n\n### Notes\n\n\n\n### Evening Reflection\n\n', true),
(NULL, 'Brain Dump', E'## Quick Capture\n\nJust write. No structure needed.\n\n---\n\n', true);
