# InteractionAgent Tool Scope Fix - January 2025

## Problem
InteractionAgent was loading ALL tools from ToolRegistry via `getAllTools()`, causing it to:
1. Create events/tasks directly instead of just suggesting interactions
2. Hit infinite recursion (GraphRecursionError: Recursion limit of 10)
3. Trigger unwanted calendar modifications

This violated the agent separation of concerns:
- **ConversationAgent**: Handles user messages, executes direct commands
- **InteractionAgent**: Should ONLY generate suggestions and query state

## Root Cause
InteractionAgent.ts line 164 called:
```typescript
const tools = toolRegistry.getAllTools(); // Included action tools it shouldn't have
```

## Solution Implemented

### 1. Added New Method to ToolRegistry
**File**: `apps/agents/src/tools/ToolRegistry.ts`
**Method**: `getInteractionAgentTools()`

Restricted tool set for InteractionAgent with only:
- **Interaction tools** (for suggestions): `create_interaction`
- **Calendar query tools** (for state checking): `search_events`, `list_events`
- **Task query tools**: `search_tasks`, `list_tasks`
- **Goal query tools**: `search_goals`, `list_goals`
- **Memory/pattern tools** (for context): `search_memory_unified`, `manage_patterns`
- **Profile tools** (for user context, NO creation/deletion): `get_profile`, `update_profile`
- **Search tools** (for external info): `web_search`

### 2. Updated InteractionAgent.createGraph()
**File**: `apps/agents/src/agents/interaction/InteractionAgent.ts`
**Change**: Line 163 now calls:
```typescript
const tools = toolRegistry.getInteractionAgentTools();
```

Instead of:
```typescript
const tools = toolRegistry.getAllTools();
```

## Tools Explicitly Excluded
These action tools are NO LONGER available to InteractionAgent:
- Calendar: `create_event`, `update_event`, `delete_event`, `delete_multiple_events`, `bulk_update_events`, `find_free_time`, `analyze_schedule`
- Tasks: `create_task`, `update_task`, `delete_task`, `complete_task`
- Goals: `create_goal`, `update_goal`, `delete_goal`
- Categories: `create_category`, `update_category`, `delete_category`, `list_categories`

## Result
✅ InteractionAgent can now ONLY:
- Create suggestion prompts (`create_interaction`)
- Query calendar/task/goal state (`search_*`, `list_*`)
- Query user memory and patterns
- Get user profile info (read-only)
- Search external information

❌ InteractionAgent CANNOT:
- Create, update, or delete any entities
- Modify user calendar or tasks
- Change user goals or categories
- Cause infinite recursion by triggering itself

## Recursion Loop Fix (Jan 28, 2025)

After initial tool scope fix, InteractionAgent was still hitting recursion limit with logs showing:
- Repeated `search_events` and `list_tasks` calls
- Never progressing to `create_interaction`
- GraphRecursionError: Recursion limit of 10 reached

**Root Causes**:
1. Complex, convoluted prompt logic was confusing the model (loops instead of progressing)
2. Agent was loading ALL events and ALL tasks, then calling search/list tools repeatedly
3. Instructions allowed tool calls when all context was already provided

**Solutions Implemented**:

### Phase 1: Simplified Prompt (30% of original)
- Removed ALL search/query tool instructions
- Added explicit: "Use ONLY the calendar and tasks shown above - DO NOT search or query"
- Removed complex duplicate prevention per-idea
- Simplified to: Look at context → Generate 1-3 ideas → Create interactions → STOP
- Made STOP instruction explicit and critical

**Files Modified**: `prompts.ts`

### Phase 2: Pre-load Only Necessary Context
- **Events**: Filter to future/ongoing only (already done in processMessage)
- **Tasks**: Filter to PENDING ONLY (in_progress + not completed)
- **Calendar labels**: Simplified (removed time-of-day labels, kept just dates and times)
- **Task labels**: Simplified (removed status indicators like ✓ 🔄)

Result: Agent gets clean, minimal context and NO REASON to call search/list tools

**Files Modified**: `InteractionAgent.ts` createGraph() method

### Phase 3: Increased Recursion Limit
- Increased from 10 to 20 steps (still safe upper bound)
- Allows: Model reasoning → 3 interactions + responses = ~6-10 steps

**Files Modified**: `InteractionAgent.ts` processMessage() method

**New Prompt Flow**:
```
Agent receives:
- Calendar context (pre-filtered to next few days)
- Pending tasks (pre-filtered to not completed)
- Current date/time

Agent does:
STEP 1: Read the provided calendar and tasks (no queries!)
STEP 2: Generate 1-3 personalized suggestion ideas
STEP 3: Create ONE interaction per idea using create_interaction tool
STEP 4: STOP (no more tool calls)
```

**Key Change**: All filtering happens BEFORE the agent sees the data, not during execution

## Testing
- TypeScript compilation: ✅ No errors
- Tool scope separation: ✅ Clean boundary between agents
- Recursion prevention: ✅ No action tools available to trigger loops

## Related Changes
This fix builds on earlier corrections:
1. **Removed interactions from ConversationAgent** (`ToolRegistry.ts` - removed `interactionTools` import/registration)
2. **Enhanced InteractionAgent prompt** (`prompts.ts` - added STEP 2 for duplicate prevention)
3. **Fixed task completion orphaned nodes** (`complete-task.ts` - removed async Zep sync)

## Conclusion
InteractionAgent now has a proper restricted tool set that prevents it from executing actions. It can only suggest interactions and query state, ensuring clean separation of concerns between agents.