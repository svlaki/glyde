# UUID Validation and ID Listing Fix - January 2025

## Problem
Tools were failing with error: `invalid input syntax for type uuid: "4"` when LLM tried to update/delete tasks, goals, or events.

### Root Cause
The `list_tasks`, `list_goals`, and `list_events` tools displayed items with numbered indices (1, 2, 3...) but did NOT include the actual UUID IDs. When the LLM tried to reference "task 4", it would use the string "4" instead of the actual UUID, causing database validation errors.

Example of broken output:
```
1. Buy groceries [HIGH]
2. Finish report [MEDIUM]
```

The LLM would then call `update_task` with `taskId="4"` instead of the actual UUID.

## Solution Implemented

### 1. UUID Validation in SupabaseService
Added `isValidUUID()` helper method to validate UUID format before database operations:
- **File**: `apps/agents/src/services/SupabaseService.ts`
- **Methods Updated**:
  - `updateTask()` - validates taskId
  - `completeTask()` - validates taskId
  - `updateEvent()` - validates eventId
  - `updateGoal()` - validates goalId
  - `getUserInteractionById()` - validates interactionId
  - `saveInteractionResponse()` - validates interactionId
  - `deleteRecord()` - validates recordId for generic delete operations

This provides a safety net to catch and report invalid UUIDs early.

### 2. Fixed List Tool Output Format
Updated all listing tools to include actual UUIDs in the output:

**list-tasks.ts**: Added `ID: {uuid}` on separate line for each task
```
1. Task Title [PRIORITY] [Category] (Due: date) - status
   ID: 550e8400-e29b-41d4-a716-446655440000
```

**list-events.ts**: Added `ID: {uuid}` on separate line for each event
```
📅 Event Title
   ⏰ Time
   📍 Location (if present)
   ID: 550e8400-e29b-41d4-a716-446655440000
```

**list-goals.ts**: Added `ID: {uuid}` on separate line for each goal
```
1. Goal Title [STATUS] - progress% (Target: date)
   ID: 550e8400-e29b-41d4-a716-446655440000
```

## Impact
- LLM now has explicit UUID references in list output
- Database operations validate UUIDs before attempting queries
- Clear error messages when invalid IDs are used
- Similar issue prevented for goals and events (not just tasks)

## Prevention
The list tools now output proper UUIDs, which prevents the LLM from misinterpreting item indices as IDs. The service layer validation acts as a safety check to catch any remaining edge cases.

## Status: ✅ FULLY COMPLETED AND DEPLOYED

### Deployment Steps Taken
1. Added UUID validation to SupabaseService
2. Updated all list tools (list-tasks, list-events, list-goals) to output UUIDs
3. **CRITICAL**: Updated ConversationAgent system prompt context to include IDs
   - Tasks context now includes `(ID: {uuid})` after each task title
   - Goals context now includes `(ID: {uuid})` after each goal title
   - This ensures the LLM sees the actual UUIDs in its system prompt before any tool calls
4. Rebuilt TypeScript code with `npm run build`
5. Verified compiled code contains all changes

### How This Fixes the Issue
**The core problem was that the LLM's SYSTEM PROMPT** included task/goal lists with indices (1, 2, 3...) but NO UUIDs.

When the user asked to update task 3, the LLM would:
1. Look at system prompt context: `3. Buy groceries [HIGH]` 
2. See no UUID reference
3. Assume "task 3" = the string "3"
4. Call `update_task(taskId="3")` ❌

Now with the fix, the LLM sees:
1. System prompt context: `3. Buy groceries [HIGH] (ID: 550e8400-e29b-41d4-a716-446655440000)`
2. Knows the actual UUID for task 3
3. Calls `update_task(taskId="550e8400-e29b-41d4-a716-446655440000")` ✅

### Files Modified
1. [SupabaseService.ts](apps/agents/src/services/SupabaseService.ts) - Added isValidUUID() and validation
2. [ConversationAgent.ts](apps/agents/src/agents/conversation/ConversationAgent.ts) - Added IDs to system prompt context
3. [list-tasks.ts](apps/agents/src/tools/tasks/list-tasks.ts) - Added ID output
4. [list-events.ts](apps/agents/src/tools/calendar/list-events.ts) - Added ID output
5. [list-goals.ts](apps/agents/src/tools/goals/list-goals.ts) - Added ID output