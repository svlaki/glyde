# Interaction Metadata & Action Workflow

## Problem
When users clicked interaction response buttons, the response was sent to the agent but:
1. The agent had no context about what action to take
2. No metadata was passed about the original interaction's intent
3. The agent would receive a generic message like "user responded to interaction: yes" but wouldn't know what to do with it

## Solution: Interaction Metadata Pattern
Implemented a metadata-driven interaction workflow where agents store actionable context when creating interactions, then use that context when processing responses.

### How It Works

**Step 1: Agent Creates Interaction WITH Metadata**
```typescript
create_interaction({
  question: "Would you like to schedule an exercise session for tomorrow?",
  type: "yes_no",
  priority: 3,
  metadata: {
    action: "create_event",
    eventTitle: "Exercise Session",
    startDate: "2025-01-26",
    suggestedTime: "09:00",
    duration: 60,
    category: "Health & Fitness"
  }
})
```

**Step 2: User Clicks Button**
- Frontend sends response to `POST /api/interactions/respond`
- Response data saved to database

**Step 3: Agent Gets Response WITH Metadata**
The `respondToInteraction()` endpoint:
1. Fetches the full interaction record (including metadata)
2. Builds a message for the agent including both the response and metadata
3. Invokes agent asynchronously with: `"User responded to interaction \"...\": yes\n[Metadata]: {...}"`

**Step 4: Agent Takes Action**
Agent receives the metadata and can immediately execute the action:
- Extract `action`, `eventTitle`, `startDate`, `suggestedTime`, `duration`, `category` from metadata
- Call `create_event` with these details
- Event is created based on user's interaction response

### Metadata Examples

**For Yes/No Interactions:**
```typescript
metadata: {
  action: "create_event",
  eventTitle: "Exercise Session",
  startDate: "2025-01-26",
  suggestedTime: "09:00",
  duration: 60,
  category: "Health & Fitness"
}
```

**For Multiple Choice with Time Options:**
```typescript
metadata: {
  action: "create_event",
  eventTitle: "Workout",
  startDate: "2025-01-26",
  duration: 60,
  category: "Health & Fitness",
  timeOptions: {
    "Early morning (6-7am)": "06:00",
    "Lunch time (12-1pm)": "12:00",
    "Evening (6-7pm)": "18:00"
  }
}
```

When user picks "Lunch time (12-1pm)", agent looks up that label in `timeOptions` to get "12:00" and creates event at that time.

**For Confirmation Actions:**
```typescript
metadata: {
  action: "delete_all_events",
  confirmationRequired: true
}
```

### System Prompt Guidance
Added detailed section to `prompts.ts` that teaches agent:
1. ALWAYS include metadata when creating interactions that will trigger actions
2. When receiving response WITH metadata, execute the action immediately
3. Extract action type and parameters from metadata
4. For multiple_choice, use timeOptions map to convert user's selection to actual time values

### Modified Files
- `/apps/agents/src/api/interactions.ts` - Updated `respondToInteraction()` to:
  - Check if interaction has metadata
  - Include metadata in the message sent to agent
  - Log metadata for debugging
  - Warn if metadata is missing (action won't be taken)

- `/apps/agents/src/agents/conversation/prompts.ts` - Added:
  - "INTERACTION METADATA (CRITICAL FOR ACTION)" section
  - Clear examples of metadata structure
  - Instructions on timeOptions mapping for multiple_choice
  - Guidance to execute actions when receiving response with metadata

### Example User Flow
1. User: "Should I exercise tomorrow?"
2. Agent: "Let me ask..." → create_interaction with metadata including "exercise at 9am for 60 min"
3. User clicks "Yes"
4. Agent receives: "User responded: yes" + metadata with event details
5. Agent calls create_event with the details from metadata
6. Event appears in user's calendar

## Key Benefits
- **Agent knows what to do**: Metadata contains all context needed
- **Type-safe actions**: Agent doesn't guess what to do, metadata specifies it
- **Flexible**: Works for any action type (create_event, create_task, delete, etc.)
- **Multiple choices**: timeOptions allows dynamic time selection UI → actual time values
- **Extensible**: Can add any fields to metadata that agent needs to know

## Testing the Workflow
1. Send query: "Should I exercise tomorrow?"
2. Wait for interaction to appear (check logs for "Interaction created")
3. Click "Yes"
4. Check logs for:
   - `📥 [INTERACTION RESPONSE] User responded...`
   - `📦 [INTERACTION RESPONSE] Interaction has metadata:` (shows metadata)
   - `🤖 [INTERACTION RESPONSE] Invoking conversation agent...` (agent called)
5. Check calendar for created event (should have the details from metadata)
