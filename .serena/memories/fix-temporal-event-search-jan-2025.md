# Fix: Temporal-Based Event Search (Prevent Old Event Modification)

## Problem
Agent was searching ALL events in the calendar (past and future) when user asked to update/delete/move events. This caused it to modify old events from months ago instead of recent ones.

Example: User says "move tutoring to 8:30" → Agent finds old tutoring session from 6 months ago instead of upcoming one.

## Root Cause
`delete_event` and `update_event` tools were calling `getEventsForAgent(userId)` which returns ALL events without temporal filtering.

## Solution

### 1. Updated `delete-event.ts`
**Changes:**
- Filter to recent events only: today + 14 days forward
- Skip past events in search
- If no recent match found but old events exist: ask user to clarify date
- If multiple matches found: list them with dates/times and ask which one

**Key logic:**
```
1. Get all events
2. Filter to: eventDate >= today
3. Fuzzy match on query
4. If no matches: check for older matches and ask user
5. If multiple matches: ask for clarification with dates/times
6. Otherwise: proceed with single match
```

### 2. Updated `update-event.ts`
**Changes:** Same as delete-event
- Filter to recent events only
- Ask for clarification when uncertain
- Never silently modify old events

### 3. Updated System Prompt
**Added CRITICAL TEMPORAL BEHAVIOR section:**
- delete_event and update_event tools only search recent events (today + 14 days)
- If not found, tool will tell agent there are older events
- Agent must ask user to clarify date before modifying old events
- Multiple matches: agent must ask which one, not guess

## Behavior After Fix

**User says:** "Move tutoring to 8:30"

**Before:**
- Found old tutoring from 6 months ago
- Silently moved it to 8:30
- User confused

**After:**
- Searches only recent events
- If tutoring not found in next 14 days: "No upcoming tutoring events found. I found 1 older tutoring event from [date]. Did you mean that one? Please specify the date."
- If multiple tutoring events found: "Found 2 tutoring events. Which one?
  - Tutoring on Wed, Jan 29 at 3:00 PM
  - Tutoring on Sat, Feb 1 at 5:30 PM"
- User provides clarification
- Agent only then modifies the correct event

## Files Modified
- `apps/agents/src/tools/calendar/delete-event.ts` - Added temporal filtering and clarification
- `apps/agents/src/tools/calendar/update-event.ts` - Added temporal filtering and clarification
- `apps/agents/src/agents/conversation/prompts.ts` - Added CRITICAL TEMPORAL BEHAVIOR section

## Search Window
- **Default:** Today + 14 days
- **Rationale:** Covers typical "next 2 weeks" planning horizon
- **Can be adjusted:** Change `setDate(futureDate.getDate() + 14)` to different value

## Impact
✅ Agent no longer modifies old events by accident
✅ Agent asks for clarification when uncertain
✅ User has control over which event is modified
✅ Safer, more predictable behavior
