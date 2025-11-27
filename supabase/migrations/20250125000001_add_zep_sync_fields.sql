-- Add Zep graph synchronization fields to improve data consistency
-- This migration adds idempotency keys and sync status tracking to all primary entity tables

-- ============================================================================
-- 1. Add fields to user_interactions table
-- ============================================================================
ALTER TABLE public.user_interactions
ADD COLUMN IF NOT EXISTS zep_idempotency_key UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS zep_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS zep_sync_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zep_sync_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS zep_sync_last_attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zep_entity_id TEXT DEFAULT NULL;

-- Create unique constraint on idempotency key to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_zep_idempotency_key
ON public.user_interactions(zep_idempotency_key);

-- Create index for finding unsynced interactions
CREATE INDEX IF NOT EXISTS idx_interactions_zep_synced
ON public.user_interactions(user_id, zep_synced)
WHERE NOT zep_synced;

-- Create index for finding interactions with sync errors
CREATE INDEX IF NOT EXISTS idx_interactions_zep_sync_error
ON public.user_interactions(user_id)
WHERE zep_sync_error IS NOT NULL;

-- ============================================================================
-- 2. Add fields to interaction_responses table
-- ============================================================================
ALTER TABLE public.interaction_responses
ADD COLUMN IF NOT EXISTS zep_idempotency_key UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS zep_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS zep_sync_error TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_responses_zep_idempotency_key
ON public.interaction_responses(zep_idempotency_key);

-- ============================================================================
-- 3. Create a table to track Zep sync attempts (audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.zep_sync_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- 'event', 'task', 'goal', 'interaction', 'memory'
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL, -- 'create', 'update', 'delete', 'sync_attempt'
    idempotency_key UUID DEFAULT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'retry', 'failed', 'skipped')),
    error_message TEXT DEFAULT NULL,
    attempt_number INTEGER DEFAULT 1,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for the sync log
CREATE INDEX IF NOT EXISTS idx_zep_sync_log_user_id ON public.zep_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_zep_sync_log_entity ON public.zep_sync_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_zep_sync_log_status ON public.zep_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_zep_sync_log_created_at ON public.zep_sync_log(created_at);

-- ============================================================================
-- 4. Create a table for Zep deadletter queue (failed operations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.zep_deadletter_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID DEFAULT NULL,
    operation TEXT NOT NULL,
    idempotency_key UUID DEFAULT NULL,
    payload JSONB NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for deadletter queue
CREATE INDEX IF NOT EXISTS idx_dlq_user_id ON public.zep_deadletter_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_dlq_next_retry ON public.zep_deadletter_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_dlq_entity ON public.zep_deadletter_queue(entity_type, entity_id);

-- ============================================================================
-- 5. Enable RLS on new tables
-- ============================================================================
ALTER TABLE public.zep_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zep_deadletter_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for zep_sync_log
CREATE POLICY "Users can view their own sync logs" ON public.zep_sync_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync logs" ON public.zep_sync_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update sync logs" ON public.zep_sync_log
    FOR UPDATE USING (true);

-- RLS policies for deadletter queue
CREATE POLICY "Users can view their own deadletter items" ON public.zep_deadletter_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage deadletter queue" ON public.zep_deadletter_queue
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update deadletter queue" ON public.zep_deadletter_queue
    FOR UPDATE USING (true);

-- ============================================================================
-- 6. Helper functions for Zep sync management
-- ============================================================================

-- Function to log a Zep sync attempt
CREATE OR REPLACE FUNCTION log_zep_sync_attempt(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_operation TEXT,
    p_idempotency_key UUID,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.zep_sync_log (
        user_id,
        entity_type,
        entity_id,
        operation,
        idempotency_key,
        status,
        error_message,
        metadata
    ) VALUES (
        p_user_id,
        p_entity_type,
        p_entity_id,
        p_operation,
        p_idempotency_key,
        p_status,
        p_error_message,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enqueue a failed Zep operation for retry
CREATE OR REPLACE FUNCTION enqueue_zep_retry(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_operation TEXT,
    p_idempotency_key UUID,
    p_payload JSONB,
    p_error_message TEXT,
    p_retry_after_seconds INTEGER DEFAULT 300
)
RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
BEGIN
    INSERT INTO public.zep_deadletter_queue (
        user_id,
        entity_type,
        entity_id,
        operation,
        idempotency_key,
        payload,
        error_message,
        next_retry_at
    ) VALUES (
        p_user_id,
        p_entity_type,
        p_entity_id,
        p_operation,
        p_idempotency_key,
        p_payload,
        p_error_message,
        NOW() + (p_retry_after_seconds || ' seconds')::interval
    )
    RETURNING id INTO v_queue_id;

    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark an interaction as synced
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

-- Function to mark an interaction with a sync error
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

-- ============================================================================
-- 7. Add comment documenting the Zep sync pattern
-- ============================================================================
COMMENT ON COLUMN public.user_interactions.zep_synced IS
'Indicates whether this interaction has been successfully synchronized to Zep graph. Set to true only after Zep confirms receipt.';

COMMENT ON COLUMN public.user_interactions.zep_idempotency_key IS
'Unique key for this interaction used to prevent duplicate Zep graph entries if sync operation is retried.';

COMMENT ON TABLE public.zep_sync_log IS
'Audit trail of all Zep synchronization attempts. Useful for debugging sync failures and understanding data consistency issues.';

COMMENT ON TABLE public.zep_deadletter_queue IS
'Queue of failed Zep sync operations waiting for retry. Prevents losing data when Zep is temporarily unavailable.';
