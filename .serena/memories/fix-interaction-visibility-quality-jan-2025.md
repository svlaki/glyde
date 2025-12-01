# Fix: Interactions Not Showing & Poor Quality (January 2025)

## Problem Statement
1. **Interactions not visible in frontend** - Created interactions weren't displaying despite being generated
2. **Poor interaction quality** - Suggestions were suggesting "create a task to work on existing tasks" (circular logic)

## Root Causes Identified

### Issue 1: Agent ID Mismatch
- **Frontend API endpoint** (`/api/interactions/pending`): Filters by `agentId: 'proactive'`
- **Interaction creation** (`create-interaction.ts`): Created with `agentId: 'conversation'`
- **Result**: Interactions created by InteractionAgent were never fetched because of filter mismatch

### Issue 2: Weak System Prompt
- Original prompt allowed "Create a task (actionable item to complete)"
- LLM interpreted this as creating NEW tasks rather than scheduling work on EXISTING tasks
- No clear distinction between actionable vs. meta-suggestions

## Solutions Applied

### Fix 1: Update Agent ID [create-interaction.ts](apps/agents/src/tools/interactions/create-interaction.ts#L16)
```typescript
// Changed from:
agentId: "conversation"

// Changed to:
agentId: "interaction"
```

This matches the InteractionAgent's ID so interactions are properly fetched by the frontend's filter on `agentId: 'interaction'`.

### Fix 2: Improve System Prompt [prompts.ts](apps/agents/src/agents/interaction/prompts.ts#L28-L71)
Completely rewrote the InteractionAgent system prompt to:

**New ALLOWED SUGGESTIONS:**
- Schedule focus/work time for **existing high-priority** tasks
- Ask if they want to prepare for upcoming events
- Check on goal progress and suggest related activities  
- Suggest using schedule gaps productively

**New FORBIDDEN SUGGESTIONS:**
- Create NEW tasks (only work on EXISTING ones)
- Suggest non-existent features
- Provide reminders without context
- General advice
- Duplicates

**New GUIDELINES:**
- Look at existing tasks and HIGH PRIORITY ones → suggest scheduling time
- Look at schedule gaps → ask if they want to use for goals/tasks
- Look at upcoming events → ask about preparation needs
- Keep suggestions specific to their actual calendar/tasks
- Only create 0-2 interactions per session (was 1-3)

## Technical Details

### Data Flow
1. Frontend button calls `/api/agent/process` with `targetAgent: 'interaction'`
2. InteractionAgent.processMessage() is invoked
3. System prompt guides LLM to call `create_interaction` tool
4. Tool creates interaction with `agentId: "interaction"`
5. Frontend fetches via `/api/interactions/pending` which filters by `agentId: 'interaction'`
6. Interactions now appear in UI

### Interaction Types Supported
- `yes_no` - Simple accept/decline
- `multiple_choice` - Multiple options (e.g., time slots)
- `confirmation` - Confirmation prompts

## Testing
- ✅ `npm run build` in apps/agents compiles successfully
- Interactions will now:
  1. Be created with correct agent ID
  2. Be fetched properly by frontend
  3. Provide better quality suggestions based on actual calendar/task context

## Next Steps (Optional)
- Monitor interaction quality and gather user feedback
- Refine prompt based on what users find helpful
- Consider adding "reason" field to interactions to explain why they were suggested
- Add analytics to track which suggestion types users respond to
