# Timezone Handling Solution for Calendar

## Problem
Calendar displayed events at incorrect times due to:
1. Conflicting timezone props in FullCalendar (line 227: userTimezone vs line 315: "local")
2. Event creation using browser local timezone instead of user profile timezone
3. Event display converting to browser local time instead of user profile timezone

## Solution Implemented

### Dependencies
- **date-fns** v4.1.0 - Date formatting and manipulation
- **date-fns-tz** v3.2.0 - Timezone conversion utilities

### Key Changes in CalendarPage.tsx

#### 1. Imports
```typescript
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
```

#### 2. Removed Conflicting Timezone Prop
Removed duplicate `timeZone="local"` at line 315, keeping only `timeZone={userTimezone}` at line 227.

#### 3. Event Display (EventModal useEffect)
```typescript
// Convert UTC from database to user's timezone for form display
const startDate = toZonedTime(new Date(event.start_time), userTimezone);
const endDate = toZonedTime(new Date(event.end_time), userTimezone);
setStartTime(format(startDate, 'HH:mm'));
setEndTime(format(endDate, 'HH:mm'));
```

#### 4. Event Creation/Update (handleSave)
```typescript
// Convert from user's timezone to UTC for database storage
const starts_at = fromZonedTime(`${baseDate}T${startTime}:00`, userTimezone);
const ends_at = fromZonedTime(`${baseDate}T${endTime}:00`, userTimezone);
```

#### 5. EventModal Interface
Added `userTimezone: string` prop to EventModalProps and passed from CalendarPage component.

## Data Flow
1. **Database**: Stores all times as UTC (timestamptz)
2. **Display**: Converts UTC → User timezone (America/Chicago for Central)
3. **User Input**: Interprets input as user timezone time
4. **Save**: Converts user timezone → UTC for storage

## Files Modified
- `/apps/frontend/src/pages/CalendarPage.tsx` - All timezone logic
- `/apps/frontend/package.json` - Added date-fns dependencies

## Result
- Consistent timezone handling across all calendar operations
- Events display in user's profile timezone (America/Chicago)
- Events stored correctly as UTC in database
- Drag/drop, create, edit all respect user timezone