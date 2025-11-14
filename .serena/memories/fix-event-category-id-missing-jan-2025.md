# Event Category ID Missing - January 2025

## Problem
All events in the calendar are displaying under "Personal" category (gray color #6B7280), even though events have different category names in the database.

## Root Cause
Events in the database have the old `category` string field populated (e.g., "Work", "Social", "School") but don't have the `category_id` foreign key field set. When the backend fetches events using `get_events_with_categories()` RPC function, the LEFT JOIN with the categories table returns NULL for all category fields because `category_id` is NULL.

## Data Flow
1. **Database**: Events table has both `category` (string, deprecated) and `category_id` (UUID, foreign key)
2. **Backend RPC**: `get_events_with_categories()` LEFT JOINs events with categories ON `e.category_id = c.id`
3. **Result**: When `category_id` is NULL, all category fields (category_name, category_color, category_icon) are NULL
4. **Frontend**: `eventPropGetter` uses `event.category_color ?? event.color ?? '#6B7280'` - falls back to gray

## Solution

### Immediate Fix
Run the migration script to populate `category_id` for existing events:

```bash
cd /Users/akashshah/Desktop/glydeeee
tsx scripts/fix-event-categories.ts
```

Or for a dry run first:
```bash
tsx scripts/fix-event-categories.ts --dry-run
```

### Alternative: SQL Script
If the TypeScript script doesn't work, run the SQL directly in Supabase SQL Editor:
```sql
-- Fix events with category names
UPDATE public.events e
SET category_id = c.id
FROM public.categories c
WHERE e.user_id = c.user_id
  AND e.category = c.name
  AND e.category IS NOT NULL
  AND e.category_id IS NULL;

-- Set default Personal category for remaining
UPDATE public.events e
SET category_id = c.id
FROM public.categories c
WHERE e.user_id = c.user_id
  AND c.name = 'Personal'
  AND e.category_id IS NULL;
```

## Prevention
The `SupabaseService.createEvent()` method already has logic to resolve category names to category_id via the `resolveCategoryId()` helper method. New events created through the agent system should automatically have category_id set.

However, events created directly via SQL or old code paths might still have this issue.

## Related Files
- `scripts/fix-event-categories.ts` - TypeScript migration script (apps/agents/src/services/SupabaseService.ts:151-193)
- `scripts/fix-event-categories.sql` - SQL migration script
- `apps/agents/src/services/SupabaseService.ts:43-55` - `resolveCategoryId()` method
- `apps/agents/src/services/SupabaseService.ts:151-193` - `createEvent()` method
- `supabase/migrations/20250105000001_add_category_id_foreign_keys.sql:47-86` - `get_events_with_categories()` RPC

## Verification
After running the script, events should display with their correct category colors:
- Work: #3b82f6 (blue)
- Social: #06b6d4 (cyan)
- Family: #f43f5e (rose)
- Exercise: #ef4444 (red)
- etc.

Refresh the calendar page to see the updated colors.
