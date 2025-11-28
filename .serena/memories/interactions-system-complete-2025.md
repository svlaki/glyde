# Interactions System - Complete Implementation & Fixes (Jan 2025)

## System Overview
The interactions system allows the agent to create interactive prompts (yes/no, multiple choice, confirmation) that the user responds to. These interactions are:
1. **Created** by the agent via `create_interaction` tool
2. **Stored** in Supabase `user_interactions` table
3. **Responded to** by users via interaction buttons in the frontend
4. **Executed** by the agent via metadata-driven action execution

## Complete Architecture

### Frontend Flow
```
User clicks "Generate Suggestions" button
  ↓
Frontend calls /api/agent/process with message: "Generate suggestions..."
  ↓
Agent (with conversation history empty) receives context
  ↓
Agent must:
  1. STEP 1: User asks to generate suggestions
  2. STEP 2: Call search_events("all") to understand calendar
  3. STEP 3: For each idea, call search_events(topic) to check for duplicates
  4. STEP 4: Identify NEW opportunities not already on calendar
  5. STEP 5: For each suggestion:
     - Choose action type (create_event vs create_task)
     - Build metadata with execution details
     - Call create_interaction tool
     - Do NOT describe in chat
  6. STEP 6: Provide brief summary
  ↓
Interactions appear in frontend UI for user to respond to
```

### Interaction Response Flow
```
User responds to interaction (e.g., clicks "Both")
  ↓
Frontend calls /api/interactions/respond with:
  - interaction_id
  - response (user's choice)
  ↓
Backend endpoint (/api/interactions.ts):
  1. Saves response to database
  2. Fetches full interaction with metadata
  3. Builds message to agent with:
     - Original question
     - User's response
     - Full metadata (action, actionable parameters)
  4. Invokes ConversationAgent to execute
  ↓
Agent receives message with metadata and response
  ↓
Agent must:
  1. PARSE the message (extract question, response, metadata)
  2. INTERPRET response (map to actual choice)
  3. EXECUTE based on action type:
     - If "schedule_tasks" + "both" → create_event for both
     - If "create_event" + "Morning" → create_event at 6am (lookup in timeOptions)
     - etc.
  4. Return confirmation message
  ↓
Response returned to frontend and displayed to user
```

## Key System Prompt Sections

### 1. CRITICAL: ACTION TYPES IN METADATA (Lines 299-312)

Three explicit RULES with keywords:

**RULE 1**: "schedule TIME" = create_event
- Keywords: "schedule time", "block time", "set aside time", "time for", "when to"
- Example: "Schedule time to work on ICCA set" → create_event, NOT create_task
- Even if no specific time yet, scheduling TIME always = create_event

**RULE 2**: "todo/action" with NO time = create_task  
- Keywords: "buy", "finish", "complete", "do", "write", "submit"
- Examples: "buy groceries", "finish homework", "call mom"

**RULE 3**: Multiple time blocks = schedule_tasks
- Use for 2+ different time-blocked activities
- Example: "Schedule time for ICCA set AND demoable app"

### 2. WORKFLOW FOR "GENERATE SUGGESTIONS" (Lines 314-339)

6-STEP process with explicit enforcement:

- **STEP 1**: User asks to generate suggestions
- **STEP 2**: MANDATORY - Call search_events("all") first
  - This MUST be your first action - never skip this
  - Understand what's already scheduled
- **STEP 3**: Search for duplicates BEFORE suggesting
  - For each idea: does similar event exist?
  - Examples: search_events("flight OR packing")
  - Don't suggest what's already on calendar
- **STEP 4**: Identify NEW opportunities
  - Free time blocks
  - Unfinished tasks to time-block
  - Goals needing progress
- **STEP 5**: For EACH suggestion:
  1. Choose correct action type (RULE 1/2/3)
  2. Build metadata with execution details
  3. Call create_interaction
  4. Do NOT describe in chat
- **STEP 6**: Brief 1-2 line summary

### 3. INTERACTION RESPONSE EXECUTION (Lines 341-404)

4-STEP execution when responding to interactions:

- **STEP 1**: PARSE - Extract question, response, metadata
- **STEP 2**: INTERPRET - Map response to actual choice
- **STEP 3**: EXECUTE - Based on action type:
  - "schedule_tasks" + "both" → create_event for both items
  - "create_event" + "Morning" → lookup in timeOptions, create at 6am
  - "check_goal_progress" → use followUpPrompt
- **STEP 4**: HANDLE FLEXIBLE RESPONSES
  - Not just yes/no, but "both", "first", "tomorrow", custom text
  - Use metadata.timeOptions to map responses to values

### 4. Examples (Lines 389-404)

Updated to explicitly show create_event (not create_task):

**Example 1**: Schedule time for multiple tasks
- Interaction: "Schedule time to work on ICCA set or demoable app tomorrow?"
- Metadata: action: "schedule_tasks", tasks: [...], date: "2025-01-28"
- Execute: Create 2 EVENTS (not tasks!):
  - Event: "ICCA set" on 2025-01-28 14:00-16:00
  - Event: "Demoable app" on 2025-01-28 16:00-18:00

**Example 2**: Multiple choice with time options
- Interaction: "When would you like to exercise?"
- Metadata: action: "create_event", eventTitle: "Workout", timeOptions: {...}
- Execute: Create EVENT at 06:00 (look up "Morning" in timeOptions)

## Backend Implementation

### File: `apps/agents/src/api/interactions.ts`

**respondToInteraction function (lines 27-172)**:

Metadata-driven execution workflow:
1. Save response to database
2. Fetch full interaction with metadata
3. Build message to agent with:
   ```
   User responded to an interactive prompt.
   Original Question: "[question]"
   User's Response: "[response]"
   Metadata: [JSON]
   
   Based on the metadata action (if present), execute the appropriate action.
   ```
4. Invoke ConversationAgent with full context
5. Return agentResponse to frontend

Key detail: conversationHistory is empty, so messages don't appear in chat history

## Tools

### create_interaction tool
- Name: "create_interaction"
- Parameters: question, type (yes_no/multiple_choice/confirmation), options, priority, metadata
- Used by agent to create interactive prompts for users

### search_events tool
- Name: "search_events"  
- Parameters: query, category, limit, includePast
- MANDATORY first step before generating suggestions
- Helps identify calendar state and avoid duplicates

### create_event / create_task tools
- Used when responding to interactions
- Agent executes based on metadata action type

### list_events tool
- Alternative to search_events for getting all upcoming events
- Can be used to understand calendar state

## Data Flow: Complete Example

### Scenario: "Schedule time to work on ICCA set or demoable app?"

**1. Generation Phase** (User clicks "Generate Suggestions")

Agent executes WORKFLOW FOR "GENERATE SUGGESTIONS":

```
STEP 2: Call search_events("all")
  → Returns: [flight event, tutoring, etc.]

STEP 3: For "schedule work" idea, call search_events("work OR ICCA OR demoable")
  → Returns: No matching events found (new opportunity!)

STEP 4: This is a new opportunity to time-block
  → Identify: User has free time tomorrow, 2 items to work on

STEP 5: Create interaction with:
  question: "Schedule time to work on ICCA set or demoable app tomorrow?"
  type: "multiple_choice"
  options: ["ICCA set only", "Demoable app only", "Both"]
  priority: 4
  metadata: {
    action: "schedule_tasks",
    tasks: [
      {title: "ICCA set", duration: 120, date: "2025-01-28"},
      {title: "Demoable app", duration: 120, date: "2025-01-28"}
    ],
    date: "2025-01-28",
    defaultTime: "14:00"
  }
  
STEP 6: "I found time tomorrow afternoon to work on your projects. Let me know which you'd like to schedule!"
```

Interaction appears in UI with 3 buttons.

**2. Response Phase** (User clicks "Both")

Frontend calls /api/interactions/respond:
```json
{
  "interaction_id": "xxx",
  "response": "Both"
}
```

Backend creates message to agent:
```
User responded to an interactive prompt.

Original Question: "Schedule time to work on ICCA set or demoable app tomorrow?"
User's Response: "Both"

Metadata:
{
  "action": "schedule_tasks",
  "tasks": [
    {"title": "ICCA set", "duration": 120, "date": "2025-01-28"},
    {"title": "Demoable app", "duration": 120, "date": "2025-01-28"}
  ],
  "date": "2025-01-28",
  "defaultTime": "14:00"
}

Based on the metadata action (if present), execute the appropriate action...
```

Agent executes INTERACTION RESPONSE EXECUTION:

```
STEP 1: PARSE
  - Question: "Schedule time..."
  - Response: "Both"
  - Action: "schedule_tasks"

STEP 2: INTERPRET
  - "Both" = user wants both tasks scheduled

STEP 3: EXECUTE
  - Action is "schedule_tasks"
  - Response is "Both" = select all tasks
  - For EACH task: call create_event
    1. create_event(title: "ICCA set", date: "2025-01-28", time: "14:00", duration: 120)
    2. create_event(title: "Demoable app", date: "2025-01-28", time: "16:00", duration: 120)
  - Return: "✅ Created 2 time blocks: ICCA set (2-4pm) and Demoable app (4-6pm) tomorrow"

STEP 4: Handle flexible responses
  - If user said "first" → only schedule first task
  - If user said "both but move to morning" → parse and create at morning time
```

Agent returns message, displayed to user.

## Common Pitfalls & Solutions

### Problem 1: Agent Creates Tasks Instead of Events
**Symptom**: "Schedule time to work" creates a task, not an event

**Solution**: 
- RULE 1 explicitly states: "schedule TIME" = create_event
- Keywords like "schedule time", "block time" trigger create_event
- Examples show create_event for time-blocking scenarios

### Problem 2: Agent Suggests Duplicates
**Symptom**: Flight event on calendar, agent suggests packing reminder

**Solution**:
- STEP 2 of workflow is MANDATORY: Call search_events("all")
- STEP 3: For each idea, call search_events(topic) to check for duplicates
- Explicit instruction: "Don't suggest what's already on calendar"

### Problem 3: Agent Doesn't Execute Metadata-Driven Actions
**Symptom**: User responds "Both" to multiple choice, nothing happens

**Solution**:
- Backend sends full metadata + response to agent
- INTERACTION RESPONSE EXECUTION section explains 4-step process
- STEP 3 has specific examples for each action type

### Problem 4: Wrong Time Chosen for Multiple Options
**Symptom**: User selects "Morning" but event created at wrong time

**Solution**:
- Metadata includes timeOptions: {"Morning": "06:00", "Afternoon": "14:00", ...}
- Agent must lookup response in timeOptions
- Example shows: Look up "Morning" → use "06:00"

## Files Modified (Session Jan 2025)

1. **apps/agents/src/agents/conversation/prompts.ts** (Lines 299-404)
   - Added RULE 1/2/3 for action type selection
   - Restructured WORKFLOW FOR "GENERATE SUGGESTIONS" with STEP 1-6
   - Added MANDATORY search_events call
   - Updated examples to show create_event (not create_task)
   - Clarified INTERACTION RESPONSE EXECUTION section

2. **apps/agents/src/api/interactions.ts** (Previous session)
   - Metadata-driven execution (lines 85-99)
   - Full metadata passed to agent with user response
   - Agent decides execution based on action type

3. **apps/agents/src/tools/calendar/delete-event.ts** (Previous session)
   - Temporal filtering: today + 14 days only
   - Fuzzy matching with query normalization
   - Clarification requests for multiple matches

4. **apps/agents/src/tools/calendar/update-event.ts** (Previous session)
   - Same temporal filtering as delete-event
   - Fuzzy matching implementation
   - Older event detection

## Testing Checklist

- [ ] Generate suggestions with flight event on calendar
  - [ ] Verify no packing suggestion created
  - [ ] Verify search_events was called
  
- [ ] Generate suggestions with free time
  - [ ] Verify interactions created with action: "schedule_tasks"
  - [ ] Verify metadata includes task details
  
- [ ] Respond "Both" to schedule multiple tasks interaction
  - [ ] Verify 2 EVENTS created (not 1 task)
  - [ ] Verify times don't conflict
  
- [ ] Respond "Morning" to multiple-choice time selection
  - [ ] Verify event created at correct morning time
  - [ ] Verify timeOptions were respected
  
- [ ] Respond "No" to yes/no interaction
  - [ ] Verify no action taken
  - [ ] Verify agent confirms dismissal

## Future Improvements

1. Add confirmation step if multiple duplicates found
2. Implement smart time slot selection (avoid conflicts)
3. Add interaction expiration (auto-dismiss old suggestions)
4. Track interaction acceptance rate for better suggestions
5. Support for conditional interactions (if-then logic)
