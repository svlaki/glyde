# EntityMappingService Removal - January 2025

## Problem Identified
EntityMappingService was a completely unused service that attempted to track mappings between Supabase entity IDs and Zep graph UUIDs. This was redundant because:

1. **Zep handles mapping internally** - When you use `graph.add()`, Zep automatically manages entity deduplication and UUID assignment
2. **No code actually used it** - The only reference was a single unused method in ZepGraphService
3. **Database table was never populated** - `storeMapping()` was never called anywhere

## What Was Removed

### Service Files
- ✅ Deleted `apps/agents/src/services/EntityMappingService.ts` (247 lines)

### Code Changes
- ✅ Removed import and usage from `ZepGraphService.ts`:
  - Removed `EntityMappingService` import
  - Removed `private mappingService` field
  - Removed `getEntityMapping()` method
  - Cleaned up `cleanupUserGraph()` to remove mapping deletion

### Database
- ✅ Created migration `20250129000001_drop_entity_mappings.sql` to drop the `entity_graph_mappings` table
- Original table created in `20250102000001_create_entity_mappings.sql`

### Scripts Updated
- ✅ `cleanup-zep-graphs.ts` - Removed entity mapping cleanup code
- ✅ `reset-user-graphs.ts` - Commented out entity mapping references  
- ✅ `clear-user-graph.ts` - Commented out entity mapping references
- ✅ `README-ZEP-SCRIPTS.md` - Contains outdated reference (documentation only)

## Why This Works

**Zep's Internal Mapping:**
- Zep automatically assigns UUIDs to entities when added via `graph.add()`
- Entities are deduplicated based on their properties, not external IDs
- You search by semantic/hybrid search, not by UUID lookups
- Temporal system handles entity invalidation automatically

**Our Approach:**
- Send entity data to Zep with `graph.add()`
- Zep handles all node management
- Search using semantic queries
- No need to track Supabase ID ↔ Zep UUID mappings

## Impact
- **-247 lines of code** removed
- **-1 database table** (entity_graph_mappings)
- **0 functional impact** - service was never actually used
- **Cleaner architecture** - no redundant abstraction layer

## Lessons Learned
Classic over-engineering: someone anticipated needing to track mappings but then Zep's API made it unnecessary. Always verify if abstractions are actually being used before building infrastructure around them.
