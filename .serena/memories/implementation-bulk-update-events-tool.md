# Bulk Update Events Tool Implementation

## Date: 2025-10-22

## Problem
Agent could not handle bulk category updates for events. When users asked to "move all X events to category Y", the agent would:
- Use `search_events` to find matching events
- Only update 1-2 events instead of all matches
- Often skip past events
- Fail to complete the full operation

**Root Cause**: No bulk update capability existed. Agent had to manually loop through `update_event` calls, which it did poorly.

## Solution Implemented

### New Tool: `bulk-update-events`
**File**: `apps/agents/src/tools/calendar/bulk-update-events.ts`

Features:
- Search by query string OR specific event IDs
- Update multiple fields: category, title, location, description
- **Includes past events** (critical - no date filtering)
- Updates Zep knowledge graph for each event
- Returns detailed summary with count and sample of updated events
- Error handling with partial success reporting

### Tool Schema
```typescript
{
  searchQuery: string | null,      // Search in title, description, location
  eventIds: string[] | null,       // Alternative: specific event IDs
  category: string | null,         // New category to assign
  title: string | null,            // Optional: new title
  location: string | null,         // Optional: new location
  description: string | null       // Optional: new description
}
```

### Pattern
Follows the same pattern as `delete-multiple-events.ts`:
1. Search for matching events (no date filter!)
2. Loop through all matches
3. Call `supabaseService.updateEvent()` for each
4. Update Zep graph asynchronously (fire-and-forget)
5. Track successes and errors
6. Return detailed summary

### Integration Points

**Files Modified**:
1. **apps/agents/src/tools/calendar/bulk-update-events.ts** (NEW)
   - Complete tool implementation with search and update logic
   
2. **apps/agents/src/tools/calendar/index.ts**
   - Added export for `bulkUpdateEventsTool`
   - Added to `calendarTools` array for auto-registration
   
3. **apps/agents/src/tools/ToolRegistry.ts**
   - No changes needed - automatically picks up from `calendarTools` array
   
4. **apps/agents/src/agents/conversation/ConversationAgent.ts**
   - Added import: `import { bulkUpdateEventsTool } from '../../tools/calendar/bulk-update-events.js'`
   - Added to tools array in `createGraph()` method

## Usage Examples

```typescript
// Move all mendicants events to Mendicants category
bulk_update_events({
  searchQuery: "mendicants",
  category: "Mendicants"
})

// Update specific events by ID
bulk_update_events({
  eventIds: ["uuid1", "uuid2", "uuid3"],
  category: "Work",
  location: "Office"
})

// Bulk rename matching events
bulk_update_events({
  searchQuery: "CS173A",
  title: "Computer Science Lecture"
})
```

## Agent Prompt Guidance

The agent now understands:
- "move all X to category Y" → use `bulk_update_events` with searchQuery
- Searches in title, description, AND location
- Includes both past and future events
- Returns detailed summary with event count and samples

## Key Implementation Details

### Search Logic
```typescript
// Get ALL events (no date filtering!)
const allEvents = await supabaseService.getEvents(userId);

// Filter by search query in multiple fields
const matchingEvents = allEvents.filter((event: any) => {
  const searchText = `${event.title} ${event.description || ''} ${event.location || ''}`.toLowerCase();
  return searchText.includes(searchQuery.toLowerCase());
});
```

### Update and Sync
```typescript
for (const event of eventsToUpdate) {
  // Update in Supabase
  const updatedEvent = await supabaseService.updateEvent(userId, event.id, updateData);
  
  // Update Zep graph (async, non-blocking)
  updateGraph(); // fire-and-forget
}
```

### Error Handling
- Tracks partial successes
- Reports which events failed and why
- Continues on errors (doesn't abort entire operation)
- Returns detailed summary with both successes and failures

## Testing Recommendations

Test scenarios:
1. ✅ "Move all mendicants events to Mendicants category"
2. ✅ Verify past events are included in the update
3. ✅ Test with non-existent search term (should return "No events found")
4. ✅ Test updating multiple fields at once (category + location)
5. ✅ Verify Zep graph is updated for all events
6. ✅ Test with partial failures (one event fails mid-operation)

## Related Changes

As part of this PR, also updated:
- **README.md**: Complete rewrite with current architecture and Docker instructions
- **start-docker.sh**: Removed Neo4j/Graphiti references, updated for Zep Cloud
- **.env.example**: Added Zep configuration, removed Neo4j/Graphiti

## Benefits

✅ Users can bulk update events with a single command
✅ Past events included in bulk operations
✅ Efficient single-pass update instead of slow loops
✅ Better error handling and reporting
✅ Consistent with existing bulk operations pattern
✅ Zep knowledge graph stays synchronized

## Related Memory Files
- `implementation-task-goal-category-integration`: Category integration for tasks/goals
- `architecture-unified-category-system`: Original category system design
- `migration-graphiti-to-zep-complete`: Zep migration context
