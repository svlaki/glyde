-- Beta Analytics Events table
-- Lightweight event tracking for beta observability
-- Frontend behavioral tracking (page views, sessions, clicks, errors)
-- Backend CRUD is already covered by user_activity_log

CREATE TABLE IF NOT EXISTS public.beta_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_properties JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  page_path TEXT,
  device_type TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_beta_analytics_user_created ON public.beta_analytics_events (user_id, created_at);
CREATE INDEX idx_beta_analytics_event_created ON public.beta_analytics_events (event_name, created_at);
CREATE INDEX idx_beta_analytics_session ON public.beta_analytics_events (session_id);
CREATE INDEX idx_beta_analytics_category_created ON public.beta_analytics_events (event_category, created_at);

-- Enable RLS
ALTER TABLE public.beta_analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own analytics events"
  ON public.beta_analytics_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own events
CREATE POLICY "Users can read own analytics events"
  ON public.beta_analytics_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Note: Service role key bypasses RLS entirely, so admin analytics
-- queries via the backend (which uses service_role key) work without
-- an explicit policy. No additional policy needed.
