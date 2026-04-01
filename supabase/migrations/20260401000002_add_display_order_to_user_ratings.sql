-- Add display_order column to user_ratings table
-- Fix: getRatingSummary query selects display_order which doesn't exist,
-- causing the query to fail silently and return empty results

ALTER TABLE public.user_ratings
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 999;
