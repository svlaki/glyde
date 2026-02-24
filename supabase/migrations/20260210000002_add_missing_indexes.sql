-- Add missing indexes for frequently queried columns
-- These indexes improve user-scoped query performance

-- Tasks: user_id lookup (used in every task query)
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);

-- Goals: user_id lookup (used in every goal query)
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);

-- Interactions: user_id lookup (used for pending interaction queries)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interactions') THEN
    CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON public.interactions(user_id);
  END IF;
END $$;

-- Events: composite index for Google Calendar sync lookups (N+1 prevention)
CREATE INDEX IF NOT EXISTS idx_events_user_google_event ON public.events(user_id, google_event_id);

-- Calendar mappings: aspect_id lookup (used when filtering by aspect)
CREATE INDEX IF NOT EXISTS idx_calendar_mappings_aspect_id ON public.user_calendar_mappings(aspect_id);

-- Activity log: user_id + created_at for recent activity queries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity_log') THEN
    CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON public.user_activity_log(user_id, created_at DESC);
  END IF;
END $$;
