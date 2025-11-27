-- Add Zep synchronization tracking fields to interactions table
-- This enables tracking of Zep graph sync status without creating additional tables yet

ALTER TABLE public.user_interactions
ADD COLUMN IF NOT EXISTS zep_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS zep_sync_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zep_sync_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS zep_sync_last_attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zep_entity_id TEXT DEFAULT NULL;

-- Create index for tracking unsynced interactions
CREATE INDEX IF NOT EXISTS idx_interactions_zep_synced
ON public.user_interactions(user_id, zep_synced)
WHERE NOT zep_synced;

-- Add helper function to mark interaction as synced
CREATE OR REPLACE FUNCTION mark_interaction_synced(
    p_interaction_id UUID,
    p_zep_entity_id TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE public.user_interactions
    SET
        zep_synced = true,
        zep_sync_error = NULL,
        zep_entity_id = COALESCE(p_zep_entity_id, zep_entity_id)
    WHERE id = p_interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helper function to mark interaction with sync error
CREATE OR REPLACE FUNCTION mark_interaction_sync_error(
    p_interaction_id UUID,
    p_error_message TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE public.user_interactions
    SET
        zep_synced = false,
        zep_sync_error = p_error_message,
        zep_sync_attempts = zep_sync_attempts + 1,
        zep_sync_last_attempted_at = NOW()
    WHERE id = p_interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
