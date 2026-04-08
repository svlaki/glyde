-- Memory system: replaces Zep Cloud with local pgvector-based memory
-- Two tables: memory_facts (extracted knowledge) + user_context_cache (pre-built summaries)

-- ============================================================================
-- memory_facts: stores extracted facts, patterns, preferences, insights
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('preference', 'pattern', 'insight', 'identity', 'behavioral')),
  source TEXT NOT NULL CHECK (source IN ('conversation', 'onboarding', 'pattern_extraction', 'agent_proactive')),
  confidence FLOAT NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_memory_facts_user_active ON public.memory_facts (user_id, is_active, category);
CREATE INDEX idx_memory_facts_embedding ON public.memory_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memory_facts_updated ON public.memory_facts (user_id, updated_at DESC);

-- RLS
ALTER TABLE public.memory_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memory facts"
  ON public.memory_facts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memory facts"
  ON public.memory_facts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memory facts"
  ON public.memory_facts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own memory facts"
  ON public.memory_facts FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass for server-side operations
CREATE POLICY "Service role full access to memory facts"
  ON public.memory_facts FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- user_context_cache: pre-built user context summaries
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_context_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  context_summary TEXT NOT NULL DEFAULT '',
  fact_count INTEGER NOT NULL DEFAULT 0,
  last_rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rebuild_trigger TEXT NOT NULL DEFAULT 'initial'
);

-- RLS
ALTER TABLE public.user_context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own context cache"
  ON public.user_context_cache FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own context cache"
  ON public.user_context_cache FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own context cache"
  ON public.user_context_cache FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to context cache"
  ON public.user_context_cache FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- match_memory_facts: vector similarity search RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION match_memory_facts(
  query_embedding vector(1536),
  p_user_id UUID,
  match_count INT DEFAULT 10,
  min_confidence FLOAT DEFAULT 0.0,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  confidence FLOAT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mf.id,
    mf.content,
    mf.category,
    mf.confidence,
    mf.metadata,
    1 - (mf.embedding <=> query_embedding) AS similarity,
    mf.created_at
  FROM public.memory_facts mf
  WHERE mf.user_id = p_user_id
    AND mf.is_active = true
    AND mf.embedding IS NOT NULL
    AND mf.confidence >= min_confidence
    AND (p_category IS NULL OR mf.category = p_category)
    AND (mf.expires_at IS NULL OR mf.expires_at > now())
  ORDER BY mf.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_memory_facts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_facts_updated_at
  BEFORE UPDATE ON public.memory_facts
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_facts_updated_at();
