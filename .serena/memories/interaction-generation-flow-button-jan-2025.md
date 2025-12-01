# Interaction Generation Flow - Button-Triggered (Not Startup)

## Current Status
User confirmed: "i dont need a startup flow i only want interactions generating when i click the button"

## How Button Flow Works

### Frontend: User Clicks "Generate Interactions" Button
**File**: `apps/frontend/src/components/AgentInteractions.tsx` (Lines 151-189)

```typescript
const handleGenerateInteractions = async () => {
  // Calls /api/agent/process with targetAgent: 'interaction'
  const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/process`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({
      context: {
        userId: user.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      message: 'Generate 2-3 proactive suggestions...',
      targetAgent: 'interaction',  // ← KEY: Routes to InteractionAgent
      isInternal: true
    })
  })
  
  // Refetch interactions after generation
  await fetchInteractions()
}
```

**Result**: Interactions are generated in database, then fetched and displayed

### Backend: Agent Processing
**Flow**:
1. `POST /api/agent/process` → `apps/agents/src/api/agent.ts`
2. `agentRegistry.routeMessage(context, message, 'interaction')`
3. Gets InteractionAgent via `agentRegistry.getAgent('interaction')`
4. Calls `interactionAgent.processMessage(context, message)`

### InteractionAgent Execution
**File**: `apps/agents/src/agents/interaction/InteractionAgent.ts`

1. Loads user's calendar events and tasks
2. Builds system prompt with current context via `buildSystemPrompt()`
3. LangGraph invokes model with tools
4. Agent calls `create_interaction` tool with metadata

### System Prompt with Explicit Rules
**File**: `apps/agents/src/agents/interaction/prompts.ts`

The prompt now includes:
- **TEMPLATE** (lines 65-82): Shows exact metadata structure
- **RULES** (lines 84-91): Explicit action type selection rules
- **EXAMPLE** (lines 93-107): Concrete template to follow

**Key Rules**:
```
- ALWAYS use "create_event" for suggesting work time or prep time
- NEVER use "update_task" unless you have the specific task ID
- NEVER use "create_task" for suggestions
- duration: Always in MINUTES
- startTime: null or ISO format
```

### Create Interaction Tool
**File**: `apps/agents/src/tools/interactions/create-interaction.ts`

1. Validates userId
2. Checks existing pending interactions (max 2 per user)
3. Creates interaction with metadata containing directAction
4. Returns success message

**Safeguards**:
- Max 2 pending interactions per user (prevents spam)
- All interactions must have directAction metadata

### Interaction Response Flow
**File**: `apps/agents/src/api/interactions.ts` (respondToInteraction)

When user responds to interaction:
1. **If response === "dismissed"**: Cancel interaction, return immediately (NO AGENT)
2. **If metadata.directAction exists**: Execute action directly (create_event, create_task, update_task)
3. **Else**: Call agent (backward compatibility)

**Direct Action Execution**:
```
If action type is "create_event":
  - Get startTime and duration from metadata.eventData
  - Calculate endTime = startTime + (duration * 60000 ms)
  - Create event in calendar via supabaseService.createEvent()
  - Mark interaction as cancelled
  - Return success (no chat message, no agent response)
```

## Complete Flow Diagram

```
User clicks "Generate Interactions" button
    ↓
Frontend: POST /api/agent/process
    ↓
targetAgent: 'interaction' → Routes to InteractionAgent
    ↓
InteractionAgent.processMessage()
    - Loads user's calendar and tasks
    - Builds system prompt with explicit rules
    - Invokes LangGraph with tools
    ↓
Agent analyzes context and calls create_interaction tool
    - Populates metadata.directAction with action type
    - Sets eventData/taskData with all details
    ↓
create_interaction tool creates record in database
    ↓
Frontend fetchInteractions() updates UI
    ↓
User sees interactions displayed
    ↓
User clicks "Yes" button
    ↓
Frontend: POST /api/interactions/respond with response="yes"
    ↓
Backend checks metadata.directAction
    ↓
Direct action executor creates event/task
    - Converts duration (minutes) to end_time
    - Creates event in calendar
    ↓
Interaction marked as cancelled
    ↓
Frontend removes interaction from UI
    ↓
User sees new event in calendar (via realtime subscription)
```

## Interaction Structure Example

```typescript
// Created by Agent via create_interaction tool
{
  id: "uuid",
  user_id: "user-uuid",
  question: "Would you like to schedule time to work on CS221 Problem Set?",
  interaction_type: "yes_no",
  priority: 4,
  status: "pending",
  metadata: {
    action: "suggestion",
    context: "CS221 Problem Set is due tomorrow",
    directAction: {
      type: "create_event",
      eventData: {
        title: "CS221 Problem Set - Focus Time",
        duration: 60,  // in MINUTES
        description: "Work on CS221 Problem Set due Dec 4",
        startTime: null,  // user chooses when
        categoryId: null  // system default
      }
    }
  }
}
```

## What's Disabled

- **Startup interactions route** (`/api/interactions/generate-startup`) - Disabled in server.ts line 260
- **Conversation agent interaction creation** - Not given create_interaction tool
- Only InteractionAgent can create interactions

## Build Status

✅ Both apps build successfully:
- `npm run build` in apps/agents (TypeScript clean)
- `npm run build` in apps/frontend (Vite build successful)

## Testing the Full Flow

1. **Start the application** - Frontend loads
2. **Click "Generate Interactions" button** - Triggers agent
3. **Check backend logs** for:
   ```
   [INTERACTION AGENT] Invoking model...
   [create-interaction] Interaction created: [question] (ID: [uuid])
   ```
4. **Verify interactions appear** in frontend
5. **Click "Yes"** on an interaction
6. **Check backend logs** for:
   ```
   [INTERACTION RESPONSE] Executing direct action
   [INTERACTION RESPONSE] Action type: create_event
   [INTERACTION RESPONSE] Event created: [event-id]
   ```
7. **Verify event appears** in calendar

## Key Files Modified
1. `apps/agents/src/agents/interaction/prompts.ts` - Updated with explicit rules
2. `apps/agents/src/api/interactions.ts` - Changed startup endpoint to use InteractionAgent
3. `apps/agents/src/api/interactions.ts` - Direct action execution implemented
4. `apps/agents/src/tools/interactions/create-interaction.ts` - Safeguard for max 2 pending
5. `apps/agents/src/agents/interaction/InteractionAgent.ts` - recursionLimit: 4 to prevent looping
6. `apps/frontend/src/components/AgentInteractions.tsx` - Dismiss buttons on all interaction types