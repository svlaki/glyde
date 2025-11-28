# Fix: Interaction Suggestion Generation - Action Type Selection and Duplicate Prevention

## Issues Fixed
1. **Agent created tasks instead of events** for "scheduling time to work" interactions
   - When user asked to "schedule time to work on ICCA set", agent created task instead of event
   - Problem: Agent wasn't distinguishing between schedule_time (EVENT) vs do_task (TASK)

2. **Agent suggested packing reminder despite flight event already on calendar**
   - When flight event existed, agent still suggested packing interaction
   - Problem: Agent wasn't checking calendar for duplicates before generating suggestions

## Root Causes
- System prompt guidance was present but too verbose and not explicitly enforced
- Agent wasn't being instructed to CALL search_events tool before generating suggestions
- Rules for choosing action type ("schedule time" = create_event) weren't explicit enough with keywords
- Workflow steps weren't numbered/explicit enough to force compliance

## Solution Implemented

### File: `apps/agents/src/agents/conversation/prompts.ts`

#### 1. **RULE-Based Action Type Selection** (Lines 299-312)
Replaced prose with explicit RULES and KEYWORDS:
- **RULE 1**: "schedule TIME" = create_event (keywords: "schedule time", "block time", "set aside time", "time for")
- **RULE 2**: "todo/action" with NO time = create_task (keywords: "buy", "finish", "complete", "do")
- **RULE 3**: Multiple time blocks = schedule_tasks

Added concrete examples showing incorrect vs correct choices:
- "Schedule time to work on ICCA set" → create_event, NOT create_task

#### 2. **Mandatory search_events Call** (Lines 314-323)
Restructured workflow with explicit STEPS:
- **STEP 1**: User asks for suggestions
- **STEP 2**: MANDATORY - Call search_events("all") to get current calendar
  - Marked as "This MUST be your first action - never skip this"
  - Uses calendar results to understand what's already scheduled
- **STEP 3**: Search for duplicates BEFORE suggesting:
  - For each idea, does a similar event already exist?
  - Examples: search_events("flight OR packing"), search_events("workout OR exercise")
  - CRITICAL: Don't suggest what's already on calendar

#### 3. **Clear Execution Steps** (Lines 324-333)
Numbered STEP 4-6 with explicit ordering:
- STEP 4: Identify NEW opportunities (not already scheduled)
- STEP 5: For each suggestion:
  1. Choose correct action type using RULE 1/2/3
  2. Build metadata with all execution details
  3. Call create_interaction
  4. Do NOT describe in chat
- STEP 6: Provide brief text summary

#### 4. **Updated Examples** (Lines 389-402)
Changed to explicitly show:
- "Schedule time to work on ICCA set" → action: "schedule_tasks" → Create 2 EVENTS (not tasks!)
- Shows exact action type (EVENTS, not tasks) that should be executed
- Shows both create_event and schedule_tasks examples

## Impact
✅ Agent now has explicit keywords to identify when "schedule time" = create_event
✅ Workflow forces agent to call search_events FIRST before generating suggestions  
✅ Step-by-step numbered workflow prevents skipping duplicate checking
✅ Examples explicitly show when to use create_event vs create_task
✅ CRITICAL REMINDERS at end reinforce key behavior

## How It Works

### For "Schedule Time" Suggestions:
1. Agent reads RULE 1: "schedule TIME" = create_event
2. Sees keywords "schedule time to work" → triggers create_event
3. Creates interaction with action: "schedule_tasks" and creates EVENTS on execution

### For Duplicate Prevention:
1. Agent reads STEP 2: MANDATORY - Call search_events first
2. Calls search_events("all") to get calendar state
3. STEP 3: For packing suggestion, calls search_events("flight OR packing")
4. If flight event found, doesn't suggest packing (duplicate prevention)

## Files Modified
- `apps/agents/src/agents/conversation/prompts.ts` (Lines 299-404)
  - CRITICAL: ACTION TYPES IN METADATA section
  - WORKFLOW FOR "GENERATE SUGGESTIONS" section
  - Updated examples in INTERACTION RESPONSE EXECUTION section

## Testing
To verify fixes work:
1. Tell agent "generate suggestions"
2. For a "schedule time" interaction created:
   - Verify interaction uses action: "create_event" or "schedule_tasks"
   - When executed, verify EVENTS are created, not TASKS
3. For duplicate prevention:
   - Add a "flight" event to calendar
   - Generate suggestions
   - Verify no "packing" interaction is suggested
