-- Add recurrence support to public.events table
-- This migration adds columns for storing recurring event rules (RFC 5545 RRULE format)

-- Add recurrence_rule column to store RRULE string (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

-- Add recurrence_end column to store when the recurrence ends (null = no end)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS recurrence_end TIMESTAMPTZ;

-- Add parent_event_id to link expanded instances back to the original recurring event
-- This allows us to update/delete all instances when the parent changes
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- Add is_recurring flag for quick filtering
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- Add index for faster queries on recurring events
CREATE INDEX IF NOT EXISTS idx_events_recurrence ON public.events(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_parent_id ON public.events(parent_event_id) WHERE parent_event_id IS NOT NULL;

-- Add comment to document the recurrence_rule format
COMMENT ON COLUMN public.events.recurrence_rule IS 'RFC 5545 RRULE format string (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10)';
COMMENT ON COLUMN public.events.recurrence_end IS 'End date for recurring events (null means no end date)';
COMMENT ON COLUMN public.events.parent_event_id IS 'References the original recurring event for expanded instances';
COMMENT ON COLUMN public.events.is_recurring IS 'Flag to quickly identify recurring events';

-- Update get_events_with_categories to include recurrence fields
CREATE OR REPLACE FUNCTION get_events_with_categories(p_user_id UUID, p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  category_icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  recurrence_end TIMESTAMPTZ,
  parent_event_id UUID,
  is_recurring BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    e.title,
    e.description,
    e.start_time,
    e.end_time,
    e.location,
    e.category_id,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon,
    e.created_at,
    e.updated_at,
    e.recurrence_rule,
    e.recurrence_end,
    e.parent_event_id,
    e.is_recurring
  FROM public.events e
  LEFT JOIN public.categories c ON e.category_id = c.id
  WHERE e.user_id = p_user_id
    AND (p_start_date IS NULL OR e.start_time >= p_start_date)
    AND (p_end_date IS NULL OR e.end_time <= p_end_date)
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
