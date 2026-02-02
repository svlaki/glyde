-- Activity Log System
-- Tracks all user and agent actions on events, tasks, and goals
-- Provides context to agents about recent manual changes

-- Create activity log table
CREATE TABLE IF NOT EXISTS public.user_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('event', 'task', 'goal', 'category', 'profile', 'rule')),
    entity_id UUID NOT NULL,
    entity_title TEXT, -- Denormalized for quick display without joins
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'complete', 'uncomplete', 'archive')),
    changes JSONB, -- { "field_name": { "old": "value", "new": "value" } }
    source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'agent')),
    agent_type TEXT, -- 'conversation', 'interaction', 'maintenance' - only set when source='agent'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fetching recent activity by user (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_activity_log_user_time
    ON public.user_activity_log(user_id, created_at DESC);

-- Index for fetching activity by source (user vs agent)
CREATE INDEX IF NOT EXISTS idx_activity_log_user_source_time
    ON public.user_activity_log(user_id, source, created_at DESC);

-- Index for fetching activity by entity (useful for entity history)
CREATE INDEX IF NOT EXISTS idx_activity_log_entity
    ON public.user_activity_log(entity_type, entity_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own activity
DROP POLICY IF EXISTS "Users can view own activity" ON public.user_activity_log;
CREATE POLICY "Users can view own activity" ON public.user_activity_log
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (agents and API)
DROP POLICY IF EXISTS "Service role can insert activity" ON public.user_activity_log;
CREATE POLICY "Service role can insert activity" ON public.user_activity_log
    FOR INSERT WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE public.user_activity_log IS 'Tracks all user and agent actions on entities for context awareness';
COMMENT ON COLUMN public.user_activity_log.changes IS 'JSON object with field changes: { "field": { "old": "...", "new": "..." } }';
COMMENT ON COLUMN public.user_activity_log.source IS 'Who made the change: user (manual) or agent (AI)';
COMMENT ON COLUMN public.user_activity_log.agent_type IS 'Which agent made the change (only when source=agent)';

-- Helper function to log activity (can be called from triggers or application code)
CREATE OR REPLACE FUNCTION public.log_activity(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_entity_title TEXT,
    p_operation TEXT,
    p_changes JSONB DEFAULT NULL,
    p_source TEXT DEFAULT 'user',
    p_agent_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.user_activity_log (
        user_id, entity_type, entity_id, entity_title,
        operation, changes, source, agent_type
    ) VALUES (
        p_user_id, p_entity_type, p_entity_id, p_entity_title,
        p_operation, p_changes, p_source, p_agent_type
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent activity for agent context
CREATE OR REPLACE FUNCTION public.get_recent_activity(
    p_user_id UUID,
    p_source TEXT DEFAULT NULL, -- NULL for all, 'user' or 'agent'
    p_minutes INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
    id UUID,
    entity_type TEXT,
    entity_id UUID,
    entity_title TEXT,
    operation TEXT,
    changes JSONB,
    source TEXT,
    agent_type TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.entity_type,
        l.entity_id,
        l.entity_title,
        l.operation,
        l.changes,
        l.source,
        l.agent_type,
        l.created_at
    FROM public.user_activity_log l
    WHERE l.user_id = p_user_id
      AND l.created_at >= (now() - (p_minutes || ' minutes')::INTERVAL)
      AND (p_source IS NULL OR l.source = p_source)
    ORDER BY l.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity TO service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_activity TO service_role;
