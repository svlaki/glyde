-- Add google_event_id and connection_id columns to events table for Google Calendar sync
-- This allows tracking which events came from external calendar providers

-- Add google_event_id column (nullable, only set for synced events)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Add connection_id column to track which connection the event came from
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES public.user_connections(id) ON DELETE SET NULL;

-- Add source column to track event origin
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'google_calendar', 'outlook_calendar', 'ics_import'));

-- Create index for efficient lookup by google_event_id
CREATE INDEX IF NOT EXISTS idx_events_google_event_id ON public.events(google_event_id) WHERE google_event_id IS NOT NULL;

-- Create unique constraint to prevent duplicate synced events
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_user_google_event_id ON public.events(user_id, google_event_id) WHERE google_event_id IS NOT NULL;

-- Create index for connection_id lookups
CREATE INDEX IF NOT EXISTS idx_events_connection_id ON public.events(connection_id) WHERE connection_id IS NOT NULL;
