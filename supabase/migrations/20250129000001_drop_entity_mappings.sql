-- Drop entity_graph_mappings table (no longer needed)
-- Zep handles entity mapping internally, no need for our own tracking table

DROP TABLE IF EXISTS public.entity_graph_mappings CASCADE;

-- Add comment for historical reference
COMMENT ON SCHEMA public IS
'Removed entity_graph_mappings table on 2025-01-29. Zep Cloud handles entity UUID mapping internally.';
