-- Add support for recurring event exceptions (deleted or modified instances)
-- This allows users to delete or modify individual instances of a recurring event

-- Create table to track exceptions (deleted/modified instances)
CREATE TABLE IF NOT EXISTS public.recurring_event_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL, -- The date of the instance being excepted
  exception_type TEXT NOT NULL CHECK (exception_type IN ('deleted', 'modified')),
  -- For modified instances, store the override event ID
  override_event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique exception per date per parent event
  UNIQUE(parent_event_id, exception_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_parent ON public.recurring_event_exceptions(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_user ON public.recurring_event_exceptions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_exceptions_date ON public.recurring_event_exceptions(exception_date);

-- Enable RLS
ALTER TABLE public.recurring_event_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS policies (drop first if exists to make migration idempotent)
DROP POLICY IF EXISTS "Users can view their own exceptions" ON public.recurring_event_exceptions;
CREATE POLICY "Users can view their own exceptions"
  ON public.recurring_event_exceptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own exceptions" ON public.recurring_event_exceptions;
CREATE POLICY "Users can insert their own exceptions"
  ON public.recurring_event_exceptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own exceptions" ON public.recurring_event_exceptions;
CREATE POLICY "Users can delete their own exceptions"
  ON public.recurring_event_exceptions FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE public.recurring_event_exceptions IS 'Tracks deleted or modified instances of recurring events';
COMMENT ON COLUMN public.recurring_event_exceptions.exception_date IS 'The date of the specific instance being excepted (YYYY-MM-DD)';
COMMENT ON COLUMN public.recurring_event_exceptions.exception_type IS 'Type of exception: deleted (instance removed) or modified (instance has override)';
COMMENT ON COLUMN public.recurring_event_exceptions.override_event_id IS 'For modified instances, points to the one-off event that replaces this instance';

-- Create function to get exceptions for a recurring event
CREATE OR REPLACE FUNCTION get_recurring_event_exceptions(p_user_id UUID, p_parent_event_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  parent_event_id UUID,
  exception_date DATE,
  exception_type TEXT,
  override_event_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.parent_event_id,
    e.exception_date,
    e.exception_type,
    e.override_event_id
  FROM public.recurring_event_exceptions e
  WHERE e.user_id = p_user_id
    AND (p_parent_event_id IS NULL OR e.parent_event_id = p_parent_event_id)
  ORDER BY e.exception_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
