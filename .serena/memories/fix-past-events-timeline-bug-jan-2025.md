# Fix: Past Events Being Treated as Current/Future Events - January 2025

## Problem Description
The ConversationAgent was pulling past events and treating them as current/future events, leading to incorrect responses. For example, when user said "need to tutor at 6pm", the agent would suggest rescheduling a tutoring event from a week ago instead of creating a new event.

## Root Cause
**NO date/time filtering was being applied** when fetching events from the database. All event queries were returning ALL events (past, present, future) regardless of when they occurred.

### Affected Locations
1. **ConversationAgent.ts:67** (processMessage method) - Initial event loading
2. **ConversationAgent.ts:173** (createGraph/callModel function) - Context loading
3. **search-events.ts:19** - Search tool
4. **list-events.ts:24-28** - List tool

## User Requirements
Based on user input:
1. **Default behavior**: Filter out past events (only show future/ongoing)
2. **Past event queries**: Allow querying past events when explicitly requested (e.g., "What did I do last week?")
3. **Ongoing events**: Include multi-day events that started in past but haven't ended yet

**Filtering logic**: Include events where `end_time >= now` (catches both future events and ongoing multi-day events)

## Solution Implemented

### 1. ConversationAgent.ts - Line 67 (processMessage)
```typescript
// BEFORE:
const userEvents = await supabaseService.getEvents(context.userId);

// AFTER:
const now = new Date();
const allEvents = await supabaseService.getEvents(context.userId);
const userEvents = allEvents.filter(event => new Date(event.end_time) >= now);
```

### 2. ConversationAgent.ts - Line 178 (createGraph/callModel)
```typescript
// BEFORE:
const eventsData = await supabaseService.getEventsForAgent(state.userId);

// AFTER:
const now = new Date();
const allEventsData = await supabaseService.getEventsForAgent(state.userId);
const eventsData = allEventsData.filter(event => new Date(event.end_time) >= now);
```

### 3. search-events.ts - Added includePast Parameter
```typescript
// Added to function signature:
async ({ query, category, limit, includePast }, config) => {

// Added filtering logic:
if (!includePast) {
  const now = new Date();
  events = events.filter((event: any) => new Date(event.end_time) >= now);
}

// Updated schema:
includePast: z.boolean().optional().describe(
  "Optional: Set to true to include past events in search. Default is false (only future/ongoing events). Use true when user asks about history like 'What did I do last week?'"
)
```

### 4. list-events.ts - Added includePast Parameter
```typescript
// Added to function signature:
async ({ startDate, endDate, limit, includePast }, config) => {

// Added filtering logic (only when no date range specified):
if (!includePast) {
  const now = new Date();
  events = events.filter((event: any) => new Date(event.end_time) >= now);
}

// Updated schema:
includePast: z.boolean().optional().describe(
  "Optional: Set to true to include past events when no date range specified. Default is false (only future/ongoing events). Use true when user asks about history."
)
```

## Filter Logic Details

### Why Filter by end_time?
- **User requirement**: Include events if "either start or end is in future"
- **Database limitation**: The `get_events_with_categories` function filters:
  - `start_time >= p_start_date` (not suitable for ongoing events)
  - `end_time <= p_end_date` (not suitable for minimum end time)
- **Solution**: Fetch all events, filter by `end_time >= now` in TypeScript

### TypeScript Filtering vs Database Filtering
**Why not use database filtering?**
- Database function doesn't support "minimum end_time" filter
- Would need to modify SQL function to add this capability
- TypeScript filtering is simpler and works immediately

**Performance consideration**:
- For large event datasets, database filtering would be more efficient
- Future improvement: Add database-level support for `end_time >= threshold`

## Testing Scenarios

### ✅ Fixed Scenarios
1. **"need to tutor at 6pm"** → Creates new event, ignores week-old tutoring event
2. **"What's on my calendar?"** → Shows only future/ongoing events
3. **Multi-day conference** (started yesterday, ends tomorrow) → Still visible
4. **Event ended 1 hour ago** → Filtered out

### ✅ Historical Queries (with includePast)
1. **"What did I do last week?"** → Agent calls search_events with includePast=true
2. **"Show me all my past meetings"** → Agent calls list_events with includePast=true

## Files Modified
1. `apps/agents/src/agents/conversation/ConversationAgent.ts` (lines 67-70, 178-186)
2. `apps/agents/src/tools/calendar/search-events.ts` (lines 7, 15, 21-26, 63, 68)
3. `apps/agents/src/tools/calendar/list-events.ts` (lines 7, 19, 31-36, 62, 67)

## Key Learnings
1. **Default to future events**: Users expect "current" context to mean future/ongoing only
2. **Explicit past queries**: Support historical queries via explicit parameter
3. **Ongoing events matter**: Filter by end_time (not start_time) to catch multi-day events
4. **TypeScript filtering**: Sometimes simpler than complex database queries
5. **Consistent filtering**: Apply same logic across all event query locations

## Future Improvements
1. **Database optimization**: Add native support for `end_time >= threshold` filtering in `get_events_with_categories` function
2. **Configurable lookback**: Allow filtering "events from last N days" for catching recently past events
3. **Smart context**: Agent could auto-detect historical queries and set includePast=true
4. **Performance monitoring**: Track if TypeScript filtering becomes bottleneck for large datasets

## Success Metrics
- ✅ Agent no longer suggests past events as current
- ✅ New event creation works correctly for natural language input
- ✅ Historical queries still supported via includePast parameter
- ✅ Ongoing multi-day events remain visible
- ✅ Consistent behavior across all event query locations