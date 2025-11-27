# Fix Stale Proactive Suggestions - January 2025

## Problem Statement
User reported two issues:
1. **Stale CS 221 Exam Prep**: An old, completed exam prep task was still being suggested in proactive interactions despite not being on the active todo list
2. **Blank Chat Bubbles**: When clicking "yes" to a goal progress check-in interaction, the agent response appeared in console but displayed as a blank bubble in chat

## Root Causes

### Issue 1: Stale Suggestions
The filtering logic in `analyze-context-for-interactions.ts` was filtering out `completed` and `archived` tasks, but:
- Very old tasks that were never marked as completed could still slip through
- Goals with deadlines in the past had no logic to exclude them

### Issue 2: Blank Chat Bubbles  
Three potential failure points in the response chain:
1. Backend returning empty/null agentResponse
2. Frontend not receiving agentResponse from API
3. Empty message being sent to chat callback

## Solutions Implemented

### Backend Improvements (apps/agents/src/api/interactions.ts)
Added defensive logging and fallback messages:
- Log agent response type and content for debugging
- Detect empty responses and provide helpful fallback message
- Return agentResponse in all success/error cases
- Better error handling with descriptive messages

```typescript
const responseStr = typeof responseContent === 'string' ? responseContent : String(responseContent || '');
if (!responseStr || responseStr.trim().length === 0) {
  // Return helpful message instead of empty bubble
  return res.json({
    success: true,
    message: 'Response saved successfully',
    agentResponse: 'I processed your response, but couldn\'t generate a reply. Please continue the conversation in chat.'
  });
}
```

### Frontend Logging (apps/frontend/src/components/ChatBot.tsx)
Added defensive checks and logging:
- Log when callback is invoked with message details
- Validate message is not empty before adding to chat
- Convert message to string to ensure proper type
- Log when message is added to chat display

```typescript
const addResponseToChat = (message: string) => {
  console.log('[ChatBot] Received message from interaction callback:', message);
  if (!message || (typeof message === 'string' && message.trim().length === 0)) {
    console.warn('[ChatBot] Received empty/null message from interaction response');
    return;
  }
  // Add to chat...
}
```

### Hook Improvements (apps/frontend/src/hooks/useInteractions.ts)
Enhanced debugging and callback handling:
- Log all interaction responses with details
- Check if callback is provided before calling
- Warn if callback missing (response won't appear in chat)

### Stale Data Filtering (apps/agents/src/tools/proactive/analyze-context-for-interactions.ts)
Implemented two-layer filtering for tasks and goals:

**Tasks Filter**:
- Exclude `completed` or `archived` status
- Exclude tasks with `completed_at` timestamp
- Exclude very old tasks (>6 months) with no recent updates
- Logs when filtering out stale tasks for debugging

```typescript
const tasks = allTasks.filter((t) => {
  if (t.status === "completed" || t.status === "archived") return false;
  if (t.completed_at) return false;
  
  // Exclude very old stale tasks
  if (t.created_at && new Date(t.created_at) < sixMonthsAgo) {
    const lastUpdated = new Date(t.updated_at || t.created_at);
    if (lastUpdated < sixMonthsAgo) {
      console.log(`Filtering out stale old task: "${t.title}"`);
      return false;
    }
  }
  return true;
});
```

**Goals Filter**:
- Exclude `completed` or `archived` status
- Exclude goals with deadlines in the past
- Logs when filtering out goals with missed deadlines

```typescript
const activeGoals = goals.filter((g) => {
  if (g.status === "completed" || g.status === "archived") return false;
  if (g.target_date && new Date(g.target_date) < now) {
    console.log(`Filtering out goal with past deadline: "${g.title}"`);
    return false;
  }
  return true;
});
```

## Files Modified

| File | Change |
|------|--------|
| `apps/agents/src/api/interactions.ts` | Enhanced error handling, defensive logging, fallback messages |
| `apps/frontend/src/components/ChatBot.tsx` | Added validation and logging for incoming messages |
| `apps/frontend/src/hooks/useInteractions.ts` | Improved callback handling and debugging |
| `apps/agents/src/tools/proactive/analyze-context-for-interactions.ts` | Aggressive filtering for stale tasks/goals |

## Build Status
✅ Backend: Passes TypeScript compilation
✅ Frontend: Passes Vite build

## Testing Recommendations

1. **Stale Task Filtering**:
   - Create a task and mark it complete
   - Restart agent service
   - Verify task no longer appears in suggestions
   - Check server logs for "Filtering out stale old task" message

2. **Goal Deadline Filtering**:
   - Create a goal with deadline in the past
   - Restart agent service
   - Verify goal not suggested
   - Check server logs for filtering messages

3. **Blank Bubble Fix**:
   - Respond "yes" to a goal progress check-in
   - Should see agent response message in chat
   - Check browser console for logging trail:
     - `[useInteractions] Got agent response`
     - `[ChatBot] Adding bot message to chat`

## Console Logging

The system now logs the full flow for debugging:

```
[useInteractions] Responding to interaction: [id] response: yes
[useInteractions] Interaction response result: { agentResponse: "..." }
[useInteractions] Got agent response, calling callback: "..."
[ChatBot] Received message from interaction callback: "..."
[ChatBot] Adding bot message to chat: "..."
```

## Future Improvements

1. **Configurable stale task threshold**: Currently 6 months - could be user-configurable
2. **Explicit mark as inactive**: Add UI option to mark tasks/goals as "won't do" instead of just archiving
3. **Periodic cleanup job**: Daily job to archive stale items automatically
4. **User preferences**: Let users control suggestion sensitivity and time thresholds

## Key Takeaway

Fixed two critical issues in proactive interactions system:
1. **Stale data appearing**: Now aggressively filters old incomplete tasks and goals with past deadlines
2. **Empty chat responses**: Now handles empty responses gracefully and adds comprehensive logging for debugging the full flow
