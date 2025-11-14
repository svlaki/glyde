# Calendar Category Colors Fix - January 2025

## Problem
All events were appearing under the "Personal" category color on the calendar, even though they had different categories in the database. Events with Work, School, Social, etc. categories were all showing the same green Personal color.

## Root Cause
The `MainCalendar` component was using the deprecated `getCategoryColor()` function which:
1. Only looked at static hardcoded category names in `CATEGORY_COLORS` map
2. Was looking for `event.category` (old string field) instead of the new category data
3. Returned a fallback color for any category name that didn't exactly match the hardcoded list

The backend was correctly returning `category_color` from the unified category system (via `get_events_with_categories` RPC function), but the frontend wasn't using it.

## Solution

### 1. Updated CalendarEvent Interface
**File**: `apps/frontend/src/lib/calendarService.ts`

Added the new category fields from the unified category system:
```typescript
export interface CalendarEvent {
  id: string
  user_id?: string
  title: string
  start_time: string
  end_time: string
  location?: string
  description?: string
  created_at?: string
  updated_at?: string
  // Old category fields (deprecated but kept for backward compatibility)
  category?: string
  color?: string
  // New category fields from unified category system
  category_id?: string
  category_name?: string
  category_color?: string
  category_icon?: string
}
```

### 2. Fixed MainCalendar EventPropGetter
**File**: `apps/frontend/src/components/calendar/MainCalendar.tsx`

Changed from:
```typescript
const eventPropGetter = useCallback((event: CalendarEventWithDates) => {
  const fallbackColor = getCategoryColor(event.category);  // ❌ Wrong!
  const baseColor = event.color ?? fallbackColor;
  // ...
}, []);
```

To:
```typescript
const eventPropGetter = useCallback((event: CalendarEventWithDates) => {
  // Use category_color from the backend (joined from categories table)
  const baseColor = event.category_color ?? event.color ?? '#6B7280';  // ✅ Correct!
  const textColor = event.textColor ?? toReadableTextColor(baseColor);

  return {
    style: {
      backgroundColor: baseColor,
      borderColor: baseColor,
      color: textColor,
    },
  };
}, []);
```

### 3. Removed Deprecated Import
Removed the import of the deprecated `getCategoryColor` function:
```typescript
// Before
import { getCategoryColor } from '@/lib/calendarCategories';

// After
// (removed)
```

## Impact
- ✅ Events now display with correct category colors from the database
- ✅ Work events show blue, Social shows orange, Family shows pink, etc.
- ✅ Custom user-created categories will show their assigned colors
- ✅ No more dependency on hardcoded category color mappings

## Data Flow
1. Database: `events` table has `category_id` foreign key to `categories` table
2. Backend RPC: `get_events_with_categories()` joins and returns `category_color`
3. SupabaseService: `getEvents()` transforms to include `category_color` field
4. API endpoint: Returns events with category metadata
5. Frontend: CalendarService fetches and returns events with category fields
6. MainCalendar: Uses `event.category_color` directly for styling

## Related Files
- `apps/frontend/src/lib/calendarService.ts` - Interface update
- `apps/frontend/src/components/calendar/MainCalendar.tsx` - Event styling fix
- `apps/agents/src/services/SupabaseService.ts` - Backend transforms
- `supabase/migrations/20250105000001_add_category_id_foreign_keys.sql` - RPC function

## Testing
After this fix, events with different categories should immediately display with their correct colors on the calendar without any page refresh needed (thanks to the real-time subscriptions already in place).
