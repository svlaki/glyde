# Fix: Flexible Interaction Response Execution (Metadata-Driven)

## Problem
When users responded to `create_interaction` prompts with multiple-choice options (e.g., "both", "first task", "tomorrow"), the backend was only checking for exact "yes"/"y" responses. All other responses were treated as "declined" and no actions executed.

Example: User asked "Would you like to schedule work on ICCA set or demoable app?" → clicks "Both" → Agent says "got it" but creates nothing.

## Root Cause
`/api/interactions/respond` endpoint had hard-coded yes/no logic (line 73):
```typescript
const userSaidYes = response.trim().toLowerCase() === 'yes' || response.trim().toLowerCase() === 'y';
```

Then it only built messages for yes/no cases. Multiple-choice responses were ignored.

## Solution: Metadata-Driven Action Execution

Changed from hard-coded yes/no logic to metadata-driven flexible responses:

### Backend Changes (`apps/agents/src/api/interactions.ts`)

**Old Approach:**
- Check if response === "yes" or "no"
- Hard-code actions for specific interaction types
- Multiple-choice responses fall through to generic handling

**New Approach:**
- Accept ANY user response
- Build message that includes:
  - Original interaction question
  - User's actual response (as-is)
  - Full metadata object
  - Instructions to agent: "Execute the action based on metadata and user's response"
- Agent receives full context and decides what to do

**Message Format to Agent:**
```
User responded to an interactive prompt.

Original Question: "[question]"
User's Response: "[response]"

Metadata:
{full metadata object as JSON}

Based on the metadata action (if present), execute the appropriate action using the details from metadata and interpreting the user's response.
For example:
- If action is "schedule_tasks" and response is "both", create events/tasks for both items
- If action is "check_goal_progress", use the followUpPrompt to guide the conversation
- If response indicates a choice from options, map the response to the correct metadata parameters

Execute the action now.
```

### System Prompt Updates (`apps/agents/src/agents/conversation/prompts.ts`)

Added comprehensive "INTERACTION RESPONSE EXECUTION" section:

1. **PARSE THE MESSAGE** - How agent receives data:
   - Original question
   - User's actual response (not limited to yes/no)
   - Full metadata

2. **INTERPRET USER'S RESPONSE** - How to map responses:
   - Yes/no → check if "yes"/"y" or "no"
   - Multiple choice → match response to options
   - Text input → use response value
   - Key: user's response tells which option they chose

3. **EXECUTE BASED ON ACTION TYPE**:
   - `schedule_tasks`: Parse response to determine which tasks, create each one
   - `check_goal_progress`: Use followUpPrompt, interpret yes/no
   - `create_event`: Use timeOptions map to convert response to concrete values

4. **HANDLE FLEXIBLE RESPONSES**:
   - Don't assume yes/no only
   - Handle "both", "all", "first one", "tomorrow", custom text
   - Create multiple items if response indicates multiple selections
   - Ask for clarification if ambiguous

5. **EXAMPLES** showing:
   - "Both" response → create multiple tasks
   - "Morning" response → look up in timeOptions → create event at 06:00

## Impact

✅ Supports any response type (yes/no, multiple choice, text input, custom)
✅ Agent has full control over interpretation and execution
✅ No hard-coded interaction types needed
✅ Easier to add new interaction formats
✅ Agent can handle nuanced responses ("both but prioritize first", etc.)

## Files Modified

1. `apps/agents/src/api/interactions.ts` - Replaced hard-coded yes/no logic with metadata-driven message building
2. `apps/agents/src/agents/conversation/prompts.ts` - Added detailed "INTERACTION RESPONSE EXECUTION" section with examples

## How It Works Now

1. **User clicks "Both"** on "Schedule ICCA set or demoable app?" interaction
2. **Backend saves response** "Both"
3. **Backend sends to agent**:
   ```
   User responded to: "Schedule work on ICCA set or demoable app?"
   User's Response: "Both"
   Metadata: {action: "schedule_tasks", tasks: [{title: "ICCA set"}, {title: "demoable app"}], date: "2025-01-28"}
   
   Execute the action now.
   ```
4. **Agent parses metadata**:
   - Sees action = "schedule_tasks"
   - Sees user response = "Both"
   - Understands: create both tasks
5. **Agent calls tools**:
   - `create_task("ICCA set", date: "2025-01-28")`
   - `create_task("demoable app", date: "2025-01-28")`
6. **Agent responds**: "I've scheduled work on both ICCA set and demoable app for tomorrow!"

## Key Insight

The metadata tells the agent WHAT to do, and the user's response tells it WHICH option the user chose. The agent combines both to execute the correct action. No hard-coded logic needed.
