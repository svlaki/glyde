-- Create user_connections table for OAuth integrations (Google Calendar, Outlook, etc.)
CREATE TABLE public.user_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Provider identification
    provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
    provider_account_id TEXT,              -- User's email/ID in the external system
    calendar_name TEXT,                    -- Display name of primary calendar

    -- OAuth tokens (encrypted at rest by Supabase)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,

    -- Sync state management
    sync_token TEXT,                       -- Provider's sync token for delta sync
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
    sync_error TEXT,                       -- Last error message if sync failed

    -- Watch subscription (for push notifications)
    watch_channel_id TEXT,                 -- Google Calendar watch channel ID
    watch_resource_id TEXT,                -- Google Calendar resource ID
    watch_expiry TIMESTAMP WITH TIME ZONE, -- When watch subscription expires

    -- Connection status
    is_active BOOLEAN DEFAULT true,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- One connection per provider per user
    UNIQUE(user_id, provider)
);

-- Enable Row Level Security
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to make idempotent)
DROP POLICY IF EXISTS "Users can view their own connections" ON public.user_connections;
CREATE POLICY "Users can view their own connections" ON public.user_connections
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own connections" ON public.user_connections;
CREATE POLICY "Users can insert their own connections" ON public.user_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own connections" ON public.user_connections;
CREATE POLICY "Users can update their own connections" ON public.user_connections
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own connections" ON public.user_connections;
CREATE POLICY "Users can delete their own connections" ON public.user_connections
    FOR DELETE USING (auth.uid() = user_id);

-- Service role policy for webhook processing and background jobs
DROP POLICY IF EXISTS "Service role can manage all connections" ON public.user_connections;
CREATE POLICY "Service role can manage all connections" ON public.user_connections
    FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_user_connections_user_id ON public.user_connections(user_id);
CREATE INDEX idx_user_connections_provider ON public.user_connections(provider);
CREATE INDEX idx_user_connections_user_provider ON public.user_connections(user_id, provider);
CREATE INDEX idx_user_connections_watch_channel ON public.user_connections(watch_channel_id) WHERE watch_channel_id IS NOT NULL;
CREATE INDEX idx_user_connections_watch_expiry ON public.user_connections(watch_expiry) WHERE watch_expiry IS NOT NULL;
CREATE INDEX idx_user_connections_sync_status ON public.user_connections(sync_status) WHERE sync_status != 'synced';

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on changes
DROP TRIGGER IF EXISTS trigger_user_connections_updated_at ON public.user_connections;
CREATE TRIGGER trigger_user_connections_updated_at
    BEFORE UPDATE ON public.user_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_user_connections_updated_at();

-- Function to get user's active connections
CREATE OR REPLACE FUNCTION get_user_connections(target_user_id UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    provider_account_id TEXT,
    calendar_name TEXT,
    sync_status TEXT,
    sync_error TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN,
    connected_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.provider,
        c.provider_account_id,
        c.calendar_name,
        c.sync_status,
        c.sync_error,
        c.last_synced_at,
        c.is_active,
        c.connected_at
    FROM public.user_connections c
    WHERE c.user_id = target_user_id
    ORDER BY c.connected_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find connection by watch channel ID (for webhook processing)
CREATE OR REPLACE FUNCTION get_connection_by_channel_id(channel_id TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    provider TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    sync_token TEXT,
    watch_resource_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.user_id,
        c.provider,
        c.access_token,
        c.refresh_token,
        c.token_expires_at,
        c.sync_token,
        c.watch_resource_id
    FROM public.user_connections c
    WHERE c.watch_channel_id = channel_id
    AND c.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get connections with expiring watch subscriptions
CREATE OR REPLACE FUNCTION get_expiring_watch_connections(minutes_from_now INTEGER)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    provider TEXT,
    watch_channel_id TEXT,
    watch_expiry TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.user_id,
        c.provider,
        c.watch_channel_id,
        c.watch_expiry
    FROM public.user_connections c
    WHERE c.is_active = true
    AND c.watch_expiry IS NOT NULL
    AND c.watch_expiry <= (now() + (minutes_from_now || ' minutes')::INTERVAL)
    ORDER BY c.watch_expiry ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
