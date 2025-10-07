# Task Category Colors - Migration Fix

## Problem
Tasks weren't showing colors on the CalendarPage because existing tasks had `category_id` set to NULL even though they had a `category` name.

## Root Cause
Older tasks were created before the category_id lookup code was added to `SupabaseService.createTask()`. These tasks only had the legacy `category` text field populated, but not the `category_id` foreign key.

## Solution
Created migration `backfill_task_category_ids` to update all existing tasks:

```sql
UPDATE tasks t
SET category_id = c.id
FROM categories c
WHERE t.category_id IS NULL
  AND t.category IS NOT NULL
  AND c.user_id = t.user_id
  AND c.name = t.category;
```

## Verification
After migration, tasks now have:
- `category_id` properly linked to categories table
- `category_name` and `category_color` returned from `get_tasks_with_categories` RPC
- Colors display correctly in both TasksPage and CalendarPage

## Debug Logs Added
Added console logs to help diagnose future issues:
- `/apps/agents/src/api/tasks.ts:25-30` - Logs category data being returned to frontend
- `/apps/frontend/src/pages/CalendarPage.tsx:79-84` - Logs tasks received with category data

## Files Modified
- Migration: `supabase/migrations/backfill_task_category_ids.sql`
- Backend API: `/apps/agents/src/api/tasks.ts` (added debug log)
- Frontend: `/apps/frontend/src/pages/CalendarPage.tsx` (added debug log + uses category_color)
- Frontend: `/apps/frontend/src/lib/taskService.ts` (Task interface has category_name and category_color)