-- FIX: Restore all aspects archived by the agent for user akashashah28@gmail.com
-- User ID: 046894db-bc0b-4d85-874c-692cf6a2c903
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Unarchive all aspects (clear archived_at)
UPDATE public.aspects
SET archived_at = NULL
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903'
  AND archived_at IS NOT NULL;

-- 2. Restore cancelled tasks back to pending (only ones cancelled today by the cascade)
UPDATE public.tasks
SET status = 'pending', updated_at = NOW()
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903'
  AND status = 'cancelled'
  AND updated_at >= NOW() - INTERVAL '24 hours';

-- 3. Restore paused goals back to active (only ones paused today by the cascade)
UPDATE public.goals
SET status = 'active', updated_at = NOW()
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903'
  AND status = 'paused'
  AND updated_at >= NOW() - INTERVAL '24 hours';

-- 4. Clear recurrence_end on recurring events that were ended today
UPDATE public.events
SET recurrence_end = NULL, updated_at = NOW()
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903'
  AND is_recurring = true
  AND recurrence_end IS NOT NULL
  AND updated_at >= NOW() - INTERVAL '24 hours';

-- 5. Check what was restored
SELECT 'aspects' AS table_name, COUNT(*) AS restored
FROM public.aspects
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903' AND archived_at IS NULL
UNION ALL
SELECT 'tasks', COUNT(*)
FROM public.tasks
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903' AND status = 'pending'
UNION ALL
SELECT 'goals', COUNT(*)
FROM public.goals
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903' AND status = 'active'
UNION ALL
SELECT 'recurring_events', COUNT(*)
FROM public.events
WHERE user_id = '046894db-bc0b-4d85-874c-692cf6a2c903' AND is_recurring = true;

COMMIT;
