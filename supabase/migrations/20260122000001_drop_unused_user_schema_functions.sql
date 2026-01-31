-- Migration: Consolidate to public schema
-- All data now lives in public schema with RLS policies.
-- Per-user schemas are no longer used.

-- ============================================
-- PART 1: Create public.chat_messages table
-- ============================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_messages
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete own chat messages" ON public.chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for backend operations
DROP POLICY IF EXISTS "Service role full access to chat messages" ON public.chat_messages;
CREATE POLICY "Service role full access to chat messages" ON public.chat_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(user_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON public.chat_messages(user_id, created_at DESC);

-- ============================================
-- PART 2: Drop unused per-user schema functions
-- ============================================

-- Drop per-user schema RPC functions (no longer needed)
DROP FUNCTION IF EXISTS public.create_user_schema_rpc(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_user_events(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.create_user_event(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_user_event(TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.add_chat_messages_to_user_schema(TEXT);

-- Drop archetype helper functions (only used by dropped per-user schema functions)
DROP FUNCTION IF EXISTS public.suggest_event_archetype(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_event_archetype_color(TEXT, JSONB);

-- ============================================
-- PART 3: Notes
-- ============================================
-- Existing per-user schemas (u_*) are left intact for data preservation.
-- To migrate data from per-user schemas to public tables, run:
--   INSERT INTO public.chat_messages (user_id, session_id, content, sender, embedding, timestamp, metadata)
--   SELECT user_id, session_id, content, sender, embedding, timestamp, metadata FROM u_[schema].chat_messages;
--
-- To list existing user schemas:
--   SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'u_%';
