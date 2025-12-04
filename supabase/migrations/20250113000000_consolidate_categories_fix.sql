-- Consolidate and fix categories system
-- This migration:
-- 1. Removes emoji characters from category names
-- 2. Removes duplicate categories (keeping first by created_at)
-- 3. Generates capital letter icons for all categories
-- 4. Ensures consistent display order

-- Helper function to generate icon from category name (capital letter)
CREATE OR REPLACE FUNCTION generate_icon_from_name(category_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Return first capital letter of the category name
  RETURN UPPER(SUBSTRING(category_name FROM 1 FOR 1));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to remove emojis - uses translate to remove common emoji codepoints
CREATE OR REPLACE FUNCTION clean_category_name(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  result := input_name;

  -- Remove common emojis by their actual characters
  -- This uses PostgreSQL's built-in Unicode support
  result := REGEXP_REPLACE(result, '[✈️✈🎶👥📚💼🧹🎬🛒🏋️‍♀️🏋️‍♂️🏋🏋️❤️❤🏥🎨🤝👶🏡]', '', 'g');

  -- Remove any remaining emoji-like patterns (symbols and emoticons)
  -- Covers mathematical operators, arrows, shapes, emoticons
  result := REGEXP_REPLACE(result, '[\u2600-\u27BF]', '', 'g');

  -- Trim leading/trailing whitespace
  result := TRIM(result);

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Temporarily drop constraint to allow duplicates during cleanup
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_key;

-- Step 1: Clean category names - remove emojis
UPDATE public.categories
SET name = clean_category_name(name);

-- Step 2: Remove duplicates AFTER cleaning names
-- Keep the oldest category (first created_at), delete newer duplicates
DELETE FROM public.categories c1
WHERE EXISTS (
  SELECT 1 FROM public.categories c2
  WHERE c1.user_id = c2.user_id
  AND c1.name = c2.name
  AND c1.created_at > c2.created_at
);

-- Re-add the unique constraint
ALTER TABLE public.categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name);

-- Step 3: Update ALL icons to capital letters (first letter of cleaned category name)
UPDATE public.categories
SET icon = generate_icon_from_name(name);

-- Step 4: Reset display_order to ensure consistent ordering
WITH ordered_cats AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as new_order
  FROM public.categories
)
UPDATE public.categories
SET display_order = (SELECT new_order FROM ordered_cats WHERE ordered_cats.id = categories.id)
WHERE EXISTS (SELECT 1 FROM ordered_cats WHERE ordered_cats.id = categories.id);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Category consolidation complete:';
  RAISE NOTICE '✓ Removed emoji characters from names';
  RAISE NOTICE '✓ Removed duplicate categories';
  RAISE NOTICE '✓ Generated capital letter icons';
  RAISE NOTICE '✓ Reset display order';
END $$;
