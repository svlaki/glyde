# Fix: User Interactions Schema Conflict

## Problem
When creating recurring events, the agent tool was failing with:
```
❌ column "action" of relation "user_interactions" does not exist
```

## Root Cause
Schema conflict between two migrations:

1. **Old migration** (`20250119000000_user_data_enhancements.sql`):
   - Created `user_interactions` table with columns: `id`, `user_id`, `interaction_type`, `action`, `context`, `result`, `timestamp`, `session_id`, `metadata`
   - Created a trigger `track_event_interactions` that inserts into `user_interactions` with the `action` column

2. **New migration** (`20250910000001_create_interactions_system.sql`):
   - Completely redefined `user_interactions` table with NEW columns: `id`, `user_id`, `question`, `type`, `options`, `event_data`, `priority`, `category`, `context`, `created_at`, `expires_at`, `status`
   - Did NOT include the `action` column
   - No trigger was created

The old trigger was still active and tried to insert data using the old schema (with `action` column), causing the error when events (and by extension, recurring events) were created.

## Solution
Created migration `20250202000001_fix_user_interactions_schema_conflict.sql` that:

1. **Dropped the old trigger**: `DROP TRIGGER track_event_interactions ON public.events`
2. **Dropped the old trigger function**: `DROP FUNCTION track_user_interaction()`
3. **Added missing columns** from later migrations if they weren't present
4. **Created proper indexes** for the new schema

## Files Modified
- Created: `supabase/migrations/20250202000001_fix_user_interactions_schema_conflict.sql`

## Key Insight
The current architecture uses explicit tool calls to create interactions (not event-driven triggers). The old trigger was a legacy artifact from an earlier design phase and was incompatible with the new schema.

## Result
- Recurring event creation now works correctly
- No more `column "action" does not exist` errors
- The `user_interactions` table is now using the correct modern schema
