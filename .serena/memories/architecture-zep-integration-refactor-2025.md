# Zep Integration Refactor - January 2025

## Status: ✅ COMPLETE

Successfully refactored Zep integration to follow best practices and fix entity_graph_mappings errors.

## Problems Fixed

### 1. Missing Database Table
**Error**: `Could not find the table 'public.entity_graph_mappings' in the schema cache`
**Fix**: Created table via Supabase MCP with proper schema, indexes, and RLS policies

### 2. Suboptimal Zep API Usage
**Before**: Using `graph.add()` with JSON for calendar events
**After**: Using `thread.add_messages()` for temporal/conversational data

### 3. Poor Entity Extraction
**Before**: JSON blobs with poor entity/relationship extraction
**After**: Natural language messages that Zep can properly parse

### 4. Missing Cleanup Functionality
**Before**: No way to reset user graphs
**After**: `cleanupUserGraph()` method using Zep's `user.delete()` API

## Architecture Changes

### ZepGraphService Refactor

#### New Pattern: thread.add_messages()
```typescript
// Calendar events as natural language messages
await client.thread.addMessages(threadId, {
  messages: [{
    role: 'system',
    content: 'Created calendar event: "Team Meeting". Scheduled for 2025-01-15 at Building A with John, Sarah',
    metadata: { event_id, event_type, title, start_time, participants }
  }]
});
```

Benefits:
- Better entity extraction (people, locations, times)
- Temporal awareness (Zep tracks when facts are valid/invalid)
- Natural relationship building
- Proper episode tracking

#### Thread Management
```typescript
private async getOrCreateThread(userId: string): Promise<string> {
  const threadId = `calendar-events-${userId}`;
  // Create thread if doesn't exist, ensure user exists
}
```

#### Update Handling
```typescript
// OLD: Delete and recreate
// NEW: Add new message, Zep auto-invalidates old facts
await updateCalendarEvent(userId, eventId, updatedEvent) {
  // Just add update message - Zep handles temporal invalidation
  await thread.addMessages(threadId, {
    messages: [{ content: 'Updated calendar event: ...' }]
  });
}
```

### Entity Mapping Pattern

**Purpose**: Track Supabase entity IDs → Zep episode UUIDs

**Table Schema**:
```sql
CREATE TABLE entity_graph_mappings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT,  -- 'CalendarEvent', 'Task', 'Goal'
  entity_id UUID,    -- Supabase ID
  graph_uuid UUID,   -- Zep episode UUID
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(entity_type, entity_id)
);
```

**Usage**:
```typescript
// Store mapping after adding to Zep
const episodeUuid = response[0]?.uuid;
await mappingService.storeMapping(userId, 'CalendarEvent', eventId, episodeUuid);

// Retrieve for deletion
const mapping = await mappingService.getMapping('CalendarEvent', eventId);
await client.graph.episode.delete(mapping.graphUuid);
```

## API Methods Refactored

### ZepGraphService

1. **addCalendarEvent()**
   - Uses `thread.addMessages()`
   - Natural language format
   - Stores episode UUID

2. **updateCalendarEvent()**
   - Adds update message
   - Zep temporal awareness auto-invalidates old facts
   - Updates mapping with new episode UUID

3. **deleteCalendarEvent()**
   - Deletes episode by UUID
   - Clears mapping from Supabase

4. **addTask()**
   - Same pattern as calendar events
   - Natural language task description

5. **cleanupUserGraph()** (NEW)
   - Deletes user from Zep via `user.delete()`
   - Clears all entity mappings
   - Resets thread cache

## Integration Points

### ZepMemoryService
- Handles conversational memory via `thread.add_messages()`
- Shared thread management pattern

### ZepGraphService
- Handles structured entities (events, tasks) via `thread.add_messages()`
- Tracks episode UUIDs for CRUD operations

### Coordination
Both services use similar thread management:
- `thread-${userId}` for conversations (ZepMemoryService)
- `calendar-events-${userId}` for events (ZepGraphService)
- Separate threads prevent cross-contamination

## Key Improvements

1. **Database**: `entity_graph_mappings` table now exists with RLS
2. **API Usage**: Following Zep best practices for temporal data
3. **Entity Extraction**: Better quality from natural language
4. **Temporal Awareness**: Updates invalidate old facts automatically
5. **Cleanup**: Full user reset via `cleanupUserGraph()`
6. **Error Handling**: Graceful 404 handling for missing users/episodes

## Testing

To test improvements:
```bash
# Clear existing user data
cd apps/agents
npm run build
node scripts/clear-user-graph.js <userId>

# Create calendar event (will now use new pattern)
# Check Zep dashboard for better entity extraction
```

## Files Modified

1. `entity_graph_mappings` table created via Supabase MCP
2. `apps/agents/src/services/ZepGraphService.ts` - Complete refactor
3. `apps/agents/scripts/clear-user-graph.js` - Updated for new cleanup

## Migration Notes

- Existing users should run `clear-user-graph.js` to reset
- Old episode UUIDs in mappings incompatible with new pattern
- Fresh start ensures clean Zep integration

## Zep Best Practices Implemented

✅ Use `thread.add_messages()` for temporal/conversational data
✅ Use `graph.add()` only for static business documents
✅ Let Zep extract entities from natural language
✅ Store episode UUIDs for deletion/tracking
✅ Use temporal awareness for updates (don't delete/recreate)
✅ Use `user.delete()` for complete user cleanup