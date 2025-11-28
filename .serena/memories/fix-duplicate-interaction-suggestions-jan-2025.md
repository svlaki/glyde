# Fix: Prevent Duplicate Interaction Suggestions

## Problem
When user accepted an interaction to create an event (e.g., "focus block") and that event appeared on the calendar, clicking "Generate" again suggested the same interaction. Redundant suggestions annoyed users.

## Root Cause
When agent generated suggestions via `generateSuggestions()`, it analyzed calendar/tasks from scratch without considering:
- What interactions were already responded to
- What events/tasks were just created from previous interaction responses
- Whether a suggested action was already present on the calendar

## Solution
Updated system prompt "WORKFLOW FOR GENERATE SUGGESTIONS" to include deduplication logic:

### Before
1. User asks to generate suggestions
2. Analyze calendar/tasks
3. Create interactions based on analysis

### After
1. User asks to generate suggestions
2. **CHECK EXISTING INTERACTIONS FIRST**:
   - Consider what interactions user already responded to
   - Look at recently created calendar items
   - Avoid suggesting same thing twice
3. Analyze calendar/tasks for NEW opportunities only
4. Create interactions for only new suggestions

### Key Instructions Added
- "Consider what interactions the user has already responded to"
- "Look at their calendar/tasks for recently created items"
- "Avoid suggesting the same thing twice (e.g., if user already created 'focus block' event, don't suggest creating one again)"
- "IMPORTANT: Avoid duplicate suggestions - don't suggest actions that have already been completed or are already visible on the calendar."

## Impact
✅ No more duplicate suggestions
✅ Agent considers recent activity when generating
✅ Smarter, more contextual suggestions
✅ Better user experience (no repetition)

## Files Modified
- `apps/agents/src/agents/conversation/prompts.ts` - Updated WORKFLOW FOR "GENERATE SUGGESTIONS" section

## How It Works
1. **User accepts interaction**: "Focus block from 3-4pm" → event created
2. **Event appears on calendar**
3. **User clicks "Generate"**
4. **Agent workflow**:
   - Checks what interactions already responded to
   - Sees "focus block" event just created on calendar
   - Analyzes remaining unmet needs
   - Only suggests NEW things (not focus blocks)
5. **Result**: New relevant suggestions, no repetition

## Technical Notes
- The agent's context includes calendar view and interaction history
- Agent can see recently created events
- Deduplication is responsibility of agent logic (via updated prompt)
- No database changes needed
