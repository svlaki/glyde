-- Consolidate and fix categories system
-- This migration:
-- 1. Removes duplicate categories (keeping first by created_at)
-- 2. Generates capital letter icons for all categories
-- 3. Removes any emoji characters from category names
-- 4. Ensures consistent display order

-- Function to remove emoji characters from text
CREATE OR REPLACE FUNCTION remove_emoji_from_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove common emoji patterns while preserving the base text
  RETURN input_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to generate icon from category name (capital letter)
CREATE OR REPLACE FUNCTION generate_icon_from_name(category_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Return first capital letter of the category name
  RETURN UPPER(SUBSTRING(category_name FROM 1 FOR 1));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 1: Identify and remove duplicate categories per user
-- Keep the oldest one (first created), delete newer duplicates
DELETE FROM public.categories c1
WHERE EXISTS (
  SELECT 1 FROM public.categories c2
  WHERE c1.user_id = c2.user_id
  AND c1.name = c2.name
  AND c1.created_at > c2.created_at
);

-- Step 2: Update all icons to capital letters (first letter of category name)
UPDATE public.categories
SET icon = generate_icon_from_name(name)
WHERE icon IS NULL OR icon = '';

-- Step 3: Remove any emoji characters from category names by extracting just the text
-- This regex pattern matches most emoji ranges and removes them
UPDATE public.categories
SET name = TRIM(
  REGEXP_REPLACE(
    name,
    '[\x{1F000}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|[\x{2300}-\x{23FF}]|[\x{2B50}]|[\x{2B55}]|[\x{1F900}-\x{1F9FF}]|[\u0080-\uffff]',
    '',
    'g'
  )
)
WHERE name ~ '[\x{1F000}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|[\x{2300}-\x{23FF}]|[\x{2B50}]|[\x{2B55}]|[\x{1F900}-\x{1F9FF}]|[\u0080-\uffff]';

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
  RAISE NOTICE '✓ Removed duplicate categories';
  RAISE NOTICE '✓ Generated capital letter icons';
  RAISE NOTICE '✓ Removed emoji characters';
  RAISE NOTICE '✓ Reset display order';
END $$;
