# Fix: Prevent Duplicate Interaction Suggestions

## Problem
Users were receiving duplicate interaction suggestions, even when they already:
1. Had work time events scheduled for those tasks
2. Had accepted the same interaction before
3. Had rejected similar suggestions

Example: Agent suggested "Would you like to schedule time for workout tomorrow?" multiple times despite workout already being on calendar.

## Root Cause Analysis

### Issue 1: ConversationAgent Creating Interactions
**Problem**: ConversationAgent had `create_interaction` tool available via ToolRegistry
- When LLM decided to be "helpful" and suggest things, it could call `create_interaction`
- This was wrong - ConversationAgent's job is to handle user messages, not generate proactive suggestions
- That's the InteractionAgent's job

**Solution**: Removed `interactionTools` from ConversationAgent's ToolRegistry
- **File**: `apps/agents/src/tools/ToolRegistry.ts`
- **Changes**:
  - Removed import of `interactionTools` (line 13)
  - Removed registration of interaction tools (lines 67-70)
  - Added comments explaining the separation

### Issue 2: Stale Context in InteractionAgent Prompt
**Problem**: Interaction agent was given static `eventContext` and `taskContext` passed at prompt build time
- These weren't dynamically queried when generating suggestions
- Agent couldn't see what was already scheduled or what interactions were pending

**Solution**: Enhanced the InteractionAgent prompt to enforce dynamic context checking
- **File**: `apps/agents/src/agents/interaction/prompts.ts`
- **Changes**:
  - Added STEP 2: MANDATORY - Check pending interactions before creating any
  - Updated workflow to require calendar search before suggestions
  - Added "NEVER suggest the same thing twice" to CRITICAL REMINDERS
  - Enhanced duplicate prevention logic

## Changes Made

### 1. ToolRegistry.ts - Remove interaction tools from ConversationAgent
```typescript
// BEFORE: interactionTools registered for all agents
interactionTools.forEach(tool => {
  this.tools.set(tool.name, tool);
});

// AFTER: Removed entirely with explanatory comment
// NOTE: Interaction tools NOT registered here
// The InteractionAgent has its own tool registry for proactive suggestions
// This separation prevents ConversationAgent from accidentally creating interactions
```

### 2. prompts.ts - Add duplicate prevention checks
Added new STEP 2 in workflow:
```
STEP 2: MANDATORY - Check pending interactions to avoid duplicates
  - BEFORE creating ANY interaction, check what pending interactions already exist
  - If a pending interaction asks "Would you like to schedule time for X?", DO NOT create another one
  - This prevents annoying duplicate suggestions
```

## Architecture

### Separation of Concerns
- **ConversationAgent**: Handles user messages, executes direct commands (schedule event, create task)
- **InteractionAgent**: Only generates proactive suggestions and processes responses
- **ToolRegistry**: Provides tools appropriate to each agent type

### Interaction Flow
1. User sends message → ConversationAgent (no create_interaction tool)
2. Agent handles request directly (create events/tasks)
3. Separately, InteractionAgent checks for suggestions to make
4. InteractionAgent MUST check:
   - Current calendar state (search_events)
   - Pending interactions (avoid duplicates)
   - Interaction response history (user already accepted?)
5. Only creates NEW interactions that don't conflict

## Impact

**Immediate**:
- ✅ ConversationAgent can no longer accidentally create interactions
- ✅ Duplicate prevention logic now in InteractionAgent prompt
- ✅ Workflow enforces checking pending interactions first

**Expected Result**:
- No more duplicate suggestions even if user already accepted
- Agent respects what's already scheduled
- Fewer context-unaware interactions

## Technical Details

### Files Modified
1. `apps/agents/src/tools/ToolRegistry.ts` - Remove interaction tool registration
2. `apps/agents/src/agents/interaction/prompts.ts` - Add duplicate prevention steps

### TypeScript Status
- ✅ No compilation errors
- ✅ All imports valid
- ✅ Type safety maintained

## Related Fixes
- Earlier fix: Removed Zep sync from `complete-task.ts` to prevent orphaned nodes
- Earlier fix: Ran cleanup script to clear accumulated graph bloat
- This fix: Prevent future duplicate interactions from being created
