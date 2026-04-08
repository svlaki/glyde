-- Add scribe agent support to notes

-- Add source column to track who created the note
ALTER TABLE notes ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user'
  CHECK (source IN ('user', 'scribe', 'agent'));

-- Update status check to include 'scribe' as a valid status
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_status_check;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS life_plans_status_check;

-- Re-add with scribe status
DO $$
BEGIN
  -- Try adding the constraint; if column doesn't have a check, this creates it
  ALTER TABLE notes ADD CONSTRAINT notes_status_check
    CHECK (status IN ('draft', 'active', 'archived', 'scribe'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Index for efficient filtering by source
CREATE INDEX IF NOT EXISTS idx_notes_source ON notes(source);

-- Index for filtering scribe notes by user and status
CREATE INDEX IF NOT EXISTS idx_notes_user_source ON notes(user_id, source);
