# Fix: Task Deletion and Event vs Task vs Goal Guidance

## Issue 1: Task Deletion Broken
Task deletion required a taskId but users naturally say "delete cs 221 task" without knowing the ID.

### Solution
Updated `delete_task` tool to support fuzzy search like `delete_event`:
- Added `searchQuery` parameter (required)
- Made `taskId` optional
- Implements same fuzzy matching logic as delete_event
- Searches task titles and descriptions
- Returns helpful error with available tasks if not found

**File**: `/apps/agents/src/tools/tasks/delete-task.ts`

```typescript
schema: z.object({
  taskId: z.string().optional().describe("Task ID to delete (optional - rarely used, prefer searchQuery)"),
  searchQuery: z.string().describe("Search query to find and delete the task. Examples: 'cs 221', 'buy groceries', 'workout'. The tool will fuzzy match against task titles and descriptions."),
})
```

## Issue 2: Poor Event vs Task vs Goal Intuition
Agent didn't know when to create events vs tasks vs goals.

### Solution
Added clear decision criteria to system prompt:

**CREATE EVENT when:**
- Has a SPECIFIC TIME (e.g., "meeting at 3pm", "dentist Tuesday 2pm")
- Time-bound activity (e.g., "class from 2-4pm")
- Appointment, meeting, or scheduled activity

**CREATE TASK when:**
- NO specific time mentioned (e.g., "buy groceries", "study for exam")
- Todo item or action to complete
- Has deadline but no specific start time (e.g., "submit report by Friday")
- Flexible timing - can be done anytime

**CREATE GOAL when:**
- Long-term objective (e.g., "learn Spanish", "lose 20 pounds")
- Has milestones or sub-goals
- Ongoing progress tracking needed

**DEFAULT DECISION TREE:**
1. Does it have a SPECIFIC TIME? → EVENT
2. Is it a todo/action item? → TASK
3. Is it a long-term objective? → GOAL

**File**: `/apps/agents/src/agents/conversation/ConversationAgent.ts:328-352`

## Updated Tool Selection Guidance
Added delete_task to tool selection instructions:
- DELETE specific task → ALWAYS use delete_task with searchQuery DIRECTLY
- Example: "delete cs 221 task" → delete_task(searchQuery="cs 221")

**File**: `/apps/agents/src/agents/conversation/ConversationAgent.ts:366-377`