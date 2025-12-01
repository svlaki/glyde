# Fix: Remove Zep Sync from Complete-Task Tool

## Problem
When a user deleted a task, an unexpected node appeared in Zep with description "this task was completed". This happened because:

1. `completeTaskTool` had a fire-and-forget async call to `zepGraphService.addTask()` (lines 28-45)
2. This async sync completed successfully and wrote the task to Zep
3. The main `supabaseService.completeTask()` call failed due to missing `completion_notes` column
4. The agent caught the error and fell back to calling `deleteTask()`
5. Result: An orphaned completed task node existed in Zep that shouldn't be there

## Root Cause
Task completion is a **state change** in Supabase, not a graph sync event. Creating duplicate "completed" nodes in Zep violates the architectural principle that Zep should be a clean state mirror of Supabase.

## Solution
Removed the fire-and-forget Zep sync from `complete-task.ts`:

### File Modified
- **Path**: `apps/agents/src/tools/tasks/complete-task.ts`
- **Lines Removed**: 28-45 (updateGraph async function and fire-and-forget call)
- **Import Removed**: `ZepGraphService` import (no longer needed)

### Replacement Pattern
Replaced with explanatory comment:
```typescript
// NOTE: We don't sync completed tasks to Zep because:
// 1. Task completion is already tracked in Supabase (status='completed')
// 2. Zep's temporal system automatically handles task invalidation when new data arrives
// 3. Adding "completed" versions creates duplicate/orphaned nodes in the graph
// 4. Completion metadata (duration, notes, rating) is accessed from task status in Supabase
// Only task DELETION should trigger graph cleanup (via deleteTask tool)
```

## Impact
- **Prevented**: Unexpected nodes being created in Zep during task completion
- **Ensured**: Only task deletion operations sync to Zep (via deleteTask tool)
- **Maintained**: Clean state synchronization between Supabase and Zep
- **TypeScript**: No compilation errors after fix

## Architectural Pattern
This aligns with the overall Zep graph bloat fix strategy:
- Graph is a state MIRROR of Supabase (not append-only)
- Only creation/deletion should sync to graph
- State changes (complete, update) only modify Supabase
- This prevents duplicate nodes and orphaned data

## Verification
- `npx tsc --noEmit` returns no errors
- complete-task.ts properly cleaned up
- No unused imports or variables
