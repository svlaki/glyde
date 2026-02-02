-- Create user_calendar_mappings table for multi-calendar support
-- Each Google account can have multiple calendars (Work, Personal, Family, etc.)
-- This table tracks which calendars to sync and maps them to Glyde aspects

CREATE TABLE IF NOT EXISTS public.user_calendar_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.user_connections(id) ON DELETE CASCADE,

    -- Google Calendar identification
    google_calendar_id TEXT NOT NULL,           -- e.g., 'primary', 'user@gmail.com', or calendar ID
    google_calendar_name TEXT,                  -- Display name from Google
    google_calendar_color TEXT,                 -- Background color from Google (hex format)
    is_primary BOOLEAN DEFAULT false,           -- Is this the user's primary calendar

    -- Aspect/Category mapping
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,

    -- Sync settings
    is_synced BOOLEAN DEFAULT false,            -- Toggle to include in sync (primary defaults to true)
    is_visible BOOLEAN DEFAULT true,            -- Toggle visibility in calendar view

    -- Per-calendar sync state
    sync_token TEXT,                            -- Google sync token for this specific calendar
    last_synced_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    UNIQUE(connection_id, google_calendar_id)
);

-- Enable RLS
ALTER TABLE public.user_calendar_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first for idempotency)
DROP POLICY IF EXISTS "Users can view own calendar mappings" ON public.user_calendar_mappings;
CREATE POLICY "Users can view own calendar mappings"
ON public.user_calendar_mappings FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own calendar mappings" ON public.user_calendar_mappings;
CREATE POLICY "Users can insert own calendar mappings"
ON public.user_calendar_mappings FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own calendar mappings" ON public.user_calendar_mappings;
CREATE POLICY "Users can update own calendar mappings"
ON public.user_calendar_mappings FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own calendar mappings" ON public.user_calendar_mappings;
CREATE POLICY "Users can delete own calendar mappings"
ON public.user_calendar_mappings FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all (for background sync jobs)
DROP POLICY IF EXISTS "Service role can manage all calendar mappings" ON public.user_calendar_mappings;
CREATE POLICY "Service role can manage all calendar mappings"
ON public.user_calendar_mappings FOR ALL
USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_calendar_mappings_user ON public.user_calendar_mappings(user_id);
CREATE INDEX idx_calendar_mappings_connection ON public.user_calendar_mappings(connection_id);
CREATE INDEX idx_calendar_mappings_category ON public.user_calendar_mappings(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_calendar_mappings_synced ON public.user_calendar_mappings(connection_id) WHERE is_synced = true;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_calendar_mappings_updated_at ON public.user_calendar_mappings;
CREATE TRIGGER update_user_calendar_mappings_updated_at
    BEFORE UPDATE ON public.user_calendar_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Helper function to get calendar mappings for a user
CREATE OR REPLACE FUNCTION get_user_calendar_mappings(p_user_id UUID)
RETURNS SETOF public.user_calendar_mappings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.user_calendar_mappings
    WHERE user_id = p_user_id
    ORDER BY is_primary DESC, google_calendar_name ASC;
$$;

-- Helper function to get mappings for a connection
CREATE OR REPLACE FUNCTION get_connection_calendar_mappings(p_connection_id UUID)
RETURNS SETOF public.user_calendar_mappings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.user_calendar_mappings
    WHERE connection_id = p_connection_id
    ORDER BY is_primary DESC, google_calendar_name ASC;
$$;

-- Helper function to get synced calendars for a connection
CREATE OR REPLACE FUNCTION get_synced_calendars(p_connection_id UUID)
RETURNS SETOF public.user_calendar_mappings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.user_calendar_mappings
    WHERE connection_id = p_connection_id AND is_synced = true
    ORDER BY is_primary DESC, google_calendar_name ASC;
$$;

COMMENT ON TABLE public.user_calendar_mappings IS 'Maps Google calendars to Glyde aspects for multi-calendar sync support';
COMMENT ON COLUMN public.user_calendar_mappings.google_calendar_id IS 'Google Calendar ID (primary or specific calendar ID)';
COMMENT ON COLUMN public.user_calendar_mappings.category_id IS 'Glyde aspect/category to assign to events from this calendar';
COMMENT ON COLUMN public.user_calendar_mappings.is_synced IS 'Whether to sync events from this calendar';
COMMENT ON COLUMN public.user_calendar_mappings.sync_token IS 'Per-calendar sync token for incremental sync';
