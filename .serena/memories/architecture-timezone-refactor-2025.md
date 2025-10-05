# Timezone Architecture Refactor - October 2025

## Problem Statement
The timezone handling across the application was fundamentally broken with multiple issues:

1. **Broken Timezone Utilities**: `convertFromUTC()` used `toZonedTime().toISOString()` which converted back to UTC (double conversion bug)
2. **Service Layer Doing Presentation Logic**: SupabaseService had separate `getEventsForAgent()` method that attempted timezone conversion
3. **Hardcoded Timezone Defaults**: Different defaults scattered across codebase (America/New_York vs America/Chicago)
4. **Redundant DB Calls**: Multiple profile fetches for timezone in same request
5. **Inconsistent Approaches**: Frontend used date-fns-tz correctly, backend used broken custom utilities

## Solution: Correct Architecture

### Data Flow
```
Database (UTC only)
    ↓ (no conversion)
Service Layer (UTC only)
    ↓ (format for display / convert for storage)
Agent/Frontend Layer (user timezone)
    ↓
User/LLM (sees local times)
```

### Key Principles
1. **Database**: Store ALL times as UTC (timestamptz) - ALWAYS
2. **Service Layer**: NO timezone conversion, return raw UTC
3. **Agent/Frontend Layer**: Handle timezone conversion for display and input
4. **No Defaults**: Timezone is REQUIRED, fetched from user profile

## Implementation Changes

### 1. Timezone Utilities (`timezoneUtils.ts`)
**Removed:**
- `convertFromUTC()` - fundamentally broken, misleading

**Updated:**
- `convertToUTC()` - now requires timezone parameter (no default)
- `formatTimeForUser()` - now requires timezone parameter
- `getCurrentTimeInTimezone()` - now requires timezone parameter

**Added:**
- `formatEventTime()` - specialized UTC → formatted string for agent display

**Behavior:**
- All functions throw error if timezone not provided
- Uses date-fns-tz for all conversions (consistent with frontend)

### 2. SupabaseService (`SupabaseService.ts`)
**Removed:**
- `convertUTCToLocalDisplay()` private method
- Timezone conversion logic from service layer
- `convertFromUTC` import

**Updated:**
- `getEventsForAgent()` - deprecated, now calls `getEvents()`
- `getEvents()` - returns raw UTC times, NO conversion
- `createEvent()` - accepts UTC times directly, NO timezone fetching

**Architecture:**
- Single data access layer returning UTC
- No presentation logic
- Caller responsible for timezone handling

### 3. ConversationAgent (`ConversationAgent.ts`)
**Updated:**
- Requires timezone from user profile (throws error if missing)
- Uses `getEvents()` instead of deprecated `getEventsForAgent()`
- Formats UTC event times using `formatInTimeZone()` directly
- Passes timezone to all tools via config

**Event Display:**
```typescript
// OLD (broken):
const startTime = new Date(e.start_time).toLocaleTimeString(..., { timeZone: state.timezone });

// NEW (correct):
const startTime = formatInTimeZone(toDate(e.start_time), state.timezone, 'h:mm a');
```

### 4. Calendar Tools
**create-event.ts:**
- Requires timezone from config (throws error if missing)
- Converts local time → UTC using `convertToUTC(startTime, timezone)`
- Uses `formatEventTime()` for display in responses
- Passes UTC to Supabase and Zep Graph

**list-events.ts:**
- Requires timezone from config
- Gets UTC events from SupabaseService
- Formats using `formatEventTime()` for user display

## Files Modified
1. `apps/agents/src/utils/timezoneUtils.ts` - Fixed utilities, removed broken function
2. `apps/agents/src/services/SupabaseService.ts` - Removed timezone logic from service
3. `apps/agents/src/agents/conversation/ConversationAgent.ts` - Fixed event formatting
4. `apps/agents/src/tools/calendar/create-event.ts` - Added proper UTC conversion
5. `apps/agents/src/tools/calendar/list-events.ts` - Added proper formatting

## Testing Checklist
- ✅ Agent displays events in correct user timezone
- ✅ Agent creates events at correct time (local → UTC → storage)
- ✅ Frontend displays events correctly (separate timezone handling)
- ✅ No double conversions
- ✅ No hardcoded defaults
- ✅ All times stored as UTC in database

## Key Learnings
1. **Separation of Concerns**: Timezone conversion belongs in presentation layer, NOT data access layer
2. **Explicit > Implicit**: Required timezone parameters prevent silent bugs
3. **Consistency**: Use same library (date-fns-tz) across frontend and backend
4. **Single Source of Truth**: User profile timezone, no defaults
5. **UTC in DB**: ALWAYS store UTC, convert only for display

## Migration Notes
- Existing events in DB are already UTC (no migration needed)
- Frontend already using correct approach (no changes needed)
- Agent now matches frontend timezone handling
- Deprecated `getEventsForAgent()` method for backward compatibility (calls `getEvents()` with warning)