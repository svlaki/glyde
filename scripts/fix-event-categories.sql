-- Script to diagnose and fix event category_id issues
-- Run this in your Supabase SQL Editor

-- Step 1: Check current state of events
SELECT
  COUNT(*) as total_events,
  COUNT(category_id) as events_with_category_id,
  COUNT(*) - COUNT(category_id) as events_missing_category_id
FROM public.events;

-- Step 2: See events without category_id but with category name
SELECT
  id,
  title,
  category,
  category_id,
  user_id,
  start_time
FROM public.events
WHERE category_id IS NULL
  AND category IS NOT NULL
LIMIT 10;

-- Step 3: Check available categories for your user
-- Replace 'YOUR_USER_ID' with your actual user ID
-- SELECT id, name, color FROM public.categories WHERE user_id = 'YOUR_USER_ID';

-- Step 4: Fix events - set category_id based on category name
-- This updates all events to have the correct category_id
UPDATE public.events e
SET category_id = c.id
FROM public.categories c
WHERE e.user_id = c.user_id
  AND e.category = c.name
  AND e.category IS NOT NULL
  AND e.category_id IS NULL;

-- Step 5: Set default "Personal" category for events with no category
-- First, get or create Personal category for each user
UPDATE public.events e
SET category_id = c.id
FROM public.categories c
WHERE e.user_id = c.user_id
  AND c.name = 'Personal'
  AND e.category_id IS NULL;

-- Step 6: Verify the fix
SELECT
  COUNT(*) as total_events,
  COUNT(category_id) as events_with_category_id,
  COUNT(*) - COUNT(category_id) as events_still_missing_category_id
FROM public.events;

-- Step 7: Check a sample of events with their categories
SELECT
  e.id,
  e.title,
  e.category as old_category_field,
  c.name as category_name,
  c.color as category_color,
  e.start_time
FROM public.events e
LEFT JOIN public.categories c ON e.category_id = c.id
ORDER BY e.start_time DESC
LIMIT 10;
