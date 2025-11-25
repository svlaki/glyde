# Agent Interactions Tool Implementation - January 2025

## Overview
Successfully implemented the `create_interaction` tool that allows the ConversationAgent to dynamically generate interactive prompts with user-selectable options. Users can respond to these interactions directly from the chat interface via the AgentInteractions sidebar component.

## Implementation Details

### Backend: Tool Creation

#### Tool File: `apps/agents/src/tools/interactions/create-interaction.ts`
- Uses LangChain's `tool()` factory function
- Follows established tool pattern (see create-task.ts)
- Accepts parameters:
  - `question` (string): The prompt to show user
  - `type` (enum): 'yes_no' | 'multiple_choice' | 'confirmation'
  - `options` (string[]): Optional array of choices for multiple_choice type
  - `priority` (1-5): Interaction priority, defaults to 3
  - `metadata` (object): Optional context for the agent

#### Tool Registration: `apps/agents/src/tools/ToolRegistry.ts`
- Added import: `import { interactionTools } from './interactions/index.js'`
- Registered interaction tools in `registerDefaultTools()`
- Updated `getToolsByCategory()` type signature to include 'interactions'
- Added to categoryPrefixes: `interactions: ['create_interaction']`

#### Service Integration: `apps/agents/src/services/SupabaseService.ts`
- **Method**: `createUserInteraction()` already exists (lines 380-448)
- Accepts:
  - `agentId`: Agent that created the interaction
  - `question`: The prompt text
  - `interactionType`: 'yes_no' | 'multiple_choice' | 'confirmation'
  - `options`: Array of button labels
  - `priority`: Integer priority
  - `metadata`: Flexible context object
- Returns: Complete interaction record with ID
- Handles duplicate detection and constraint violations

### Frontend: Component Wiring

#### AgentInteractions Component: `apps/frontend/src/components/AgentInteractions.tsx`
**Changes**:
- Replaced hardcoded dummy data with `useInteractions()` hook
- Added `handleResponse()` function that calls `respondToInteraction()`
- Implemented `getButtonOptions()` to dynamically generate buttons based on interaction type:
  - **yes_no**: ["Yes", "No"]
  - **multiple_choice**: Uses `interaction.options` array
  - **confirmation**: ["Confirm", "Cancel"]
- Added loading state with visual feedback (disabled buttons, opacity, "..." text)
- Dynamic button layout (flex for 2 buttons, wrap for 3+)

#### Interaction Hook: `apps/frontend/src/hooks/useInteractions.ts`
- Already fully implemented and integrated
- Features:
  - Real-time Supabase subscriptions via custom events
  - Automatic priority-based sorting
  - Optimistic UI updates (immediate removal on response)
  - Periodic expiration checks (every 60 seconds)
  - Category color display support

#### Interaction Service: `apps/frontend/src/lib/interactions/interactionService.ts`
- Already properly configured
- Handles:
  - Real-time Postgres change subscriptions
  - `respondToInteraction()` API calls to `/api/interactions/respond`
  - `dismissInteraction()` for manual cancellation
  - `getPendingInteractions()` with priority ordering

## End-to-End Flow

```
User Message
    ↓
ConversationAgent processes message
    ↓
LLM decides to call create_interaction tool
    ↓
Tool creates record in user_interactions table via SupabaseService
    ↓
Supabase emits real-time update
    ↓
interactionService receives 'interaction-update' custom event
    ↓
useInteractions hook updates state
    ↓
AgentInteractions component renders new interaction with buttons
    ↓
User clicks button (e.g., "Yes", "Tomorrow", "Confirm")
    ↓
handleResponse() calls respondToInteraction()
    ↓
Frontend makes POST to /api/interactions/respond
    ↓
Backend processes response and updates status
    ↓
Supabase emits UPDATE event
    ↓
Interaction removed from UI (optimistic update)
```

## Key Features

✅ **Dynamic Button Generation**: Tool allows agent to define custom options (yes/no, time selections, multiple choices, etc.)
✅ **Priority-Based Sorting**: Higher priority interactions appear first in sidebar
✅ **Real-Time Updates**: Supabase subscriptions push changes instantly to frontend
✅ **Optimistic UI**: Interactions disappear immediately when user responds
✅ **Error Handling**: Both tool and frontend handle failures gracefully
✅ **Loading States**: Visual feedback while processing responses
✅ **Knowledge Graph Integration**: Fire-and-forget async persistence to Zep (non-blocking)

## Tool Usage Example

When the ConversationAgent needs to ask the user a question with options:

```typescript
// Agent calls the tool (automatically via LangChain)
create_interaction({
  question: "Should I schedule a workout for tomorrow morning?",
  type: "yes_no",
  priority: 4,
  metadata: { suggestedTime: "6:00 AM", activity: "running" }
})

// Or with multiple options:
create_interaction({
  question: "When would you like to schedule deep work this week?",
  type: "multiple_choice",
  options: ["Tomorrow morning", "Tomorrow afternoon", "Next week"],
  priority: 3
})
```

## Integration with Existing Systems

- **ConversationAgent**: Tool automatically available via ToolRegistry
- **Supabase Database**: Uses existing `user_interactions` table schema
- **Frontend State**: Integrates with existing useInteractions hook pattern
- **Real-time Updates**: Leverages Supabase Postgres Change subscriptions
- **Knowledge Graph**: Compatible with Zep async persistence (non-critical)

## Files Modified/Created

**Created**:
- `apps/agents/src/tools/interactions/create-interaction.ts`
- `apps/agents/src/tools/interactions/index.ts`

**Modified**:
- `apps/agents/src/tools/ToolRegistry.ts` (registration)
- `apps/frontend/src/components/AgentInteractions.tsx` (frontend integration)

**Existing & Used**:
- `apps/agents/src/services/SupabaseService.ts` (createUserInteraction method)
- `apps/frontend/src/hooks/useInteractions.ts` (already fully implemented)
- `apps/frontend/src/lib/interactions/interactionService.ts` (already fully configured)

## ProactiveAgent Deprecation Note

The existing `ProactiveAgent` can now be removed since interactions are handled directly by `ConversationAgent` via the `create_interaction` tool. This simplifies the agent architecture by consolidating interaction creation into a single flow.

## Next Steps (Future)

1. **Test**: Send messages to agent requesting interactions (e.g., "Should I exercise?")
2. **Verify**: Check that interactions appear in frontend in real-time
3. **Monitor**: Ensure responses are saved correctly to database
4. **Cleanup**: Remove ProactiveAgent if not needed elsewhere
5. **Enhance**: Add interaction history/analytics if desired
