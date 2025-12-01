# Fix: Empty String Updates Overwriting Data - January 2025

## Problem
After fixing the UUID issue, tools were being called with empty string values for optional fields, which were overwriting data with blanks.

Example:
```
update_task(taskId="uuid", title: '', description: '', dueDate: '2025-12-07', ...)
```

This caused task titles to be blanked out and other fields to be cleared.

## Root Cause
The LLM doesn't always have values for all optional fields when calling update tools. It was sending empty strings `""` as default values, and the tools were treating these as valid updates to apply.

## Solution Implemented

**Updated 3 tools** to skip empty string values:

1. **update-task.ts** 
   - Skip updating title/description/dueDate/category if empty string
   - Always include priority/status/energyRequired if provided (enums, can't be empty)
   - Skip estimatedDuration if 0

2. **update-goal.ts**
   - Skip updating title/description/targetDate/category if empty string  
   - Always include status if provided (enum)
   - Skip progress/priorityScore if null

3. **update-event.ts**
   - Already had better handling with `|| undefined` pattern
   - Improved to explicitly check for empty/whitespace strings
   - Skip title/location/description if empty or whitespace-only

## Pattern Applied
```typescript
// Before (overwrites with empty strings)
if (title !== undefined) updates.title = title;

// After (only updates if provided with actual value)
if (title !== undefined && title.trim() !== '') updates.title = title;
```

## Files Modified
- apps/agents/src/tools/tasks/update-task.ts
- apps/agents/src/tools/goals/update-goal.ts  
- apps/agents/src/tools/calendar/update-event.ts

## Status
✅ All tools updated and rebuilt successfully