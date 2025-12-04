-- Fix conflicting user_interactions schema
-- The old migration (20250119000000) creates a trigger that tries to insert into user_interactions with 'action' column
-- But the new migration (20250910000001) creates user_interactions WITHOUT 'action' column
-- This causes errors when creating events/recurring events

-- Drop the old trigger that references the non-existent 'action' column
DROP TRIGGER IF EXISTS track_event_interactions ON public.events;

-- Drop the old trigger function
DROP FUNCTION IF EXISTS track_user_interaction();

-- Verify that the current user_interactions schema is correct (from 20250910000001)
-- The correct schema should have:
-- - id UUID
-- - user_id UUID
-- - question TEXT
-- - type TEXT
-- - options JSONB
-- - event_data JSONB
-- - priority INTEGER
-- - category TEXT
-- - context JSONB
-- - created_at TIMESTAMP WITH TIME ZONE
-- - expires_at TIMESTAMP WITH TIME ZONE
-- - status TEXT

-- Add any missing columns from later migrations if they don't exist
ALTER TABLE public.user_interactions
ADD COLUMN IF NOT EXISTS agent_id TEXT,
ADD COLUMN IF NOT EXISTS interaction_type TEXT,
ADD COLUMN IF NOT EXISTS category_id UUID,
ADD COLUMN IF NOT EXISTS entity_id UUID,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS zep_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS zep_sync_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zep_sync_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS zep_sync_last_attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zep_entity_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zep_idempotency_key UUID DEFAULT gen_random_uuid();

-- Create unique index on idempotency key if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_zep_idempotency_key
ON public.user_interactions(zep_idempotency_key);

-- Create index for finding unsynced interactions if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_interactions_zep_synced
ON public.user_interactions(user_id, zep_synced)
WHERE NOT zep_synced;

-- Note: No new trigger is created because the current architecture
-- uses explicit tool calls to create interactions, not event-driven triggers
