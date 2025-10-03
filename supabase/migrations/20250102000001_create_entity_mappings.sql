-- Create entity_graph_mappings table for persistent Zep UUID storage
-- This replaces the in-memory cache in EntityMappingService

CREATE TABLE public.entity_graph_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- 'CalendarEvent', 'Task', 'Goal'
  entity_id UUID NOT NULL,    -- Supabase entity ID
  graph_uuid UUID NOT NULL,   -- Zep graph entity UUID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique mapping per entity
  UNIQUE(entity_type, entity_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_entity_mappings_user_id ON public.entity_graph_mappings(user_id);
CREATE INDEX idx_entity_mappings_entity ON public.entity_graph_mappings(entity_type, entity_id);
CREATE INDEX idx_entity_mappings_graph_uuid ON public.entity_graph_mappings(graph_uuid);

-- Enable Row Level Security
ALTER TABLE public.entity_graph_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own mappings
CREATE POLICY "Users can manage their own entity mappings"
ON public.entity_graph_mappings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.entity_graph_mappings TO authenticated;

-- Add comment
COMMENT ON TABLE public.entity_graph_mappings IS
'Maps Supabase entity IDs to Zep knowledge graph UUIDs for persistent storage';
