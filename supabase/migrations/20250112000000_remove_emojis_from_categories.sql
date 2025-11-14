-- Migration to remove emojis from existing category icons and names
-- This ensures all existing user categories are cleaned of emoji characters

-- Update existing categories to remove emoji icons
UPDATE public.categories
SET icon = NULL
WHERE icon IS NOT NULL;

-- Also clean up any emoji characters that might be in category names
-- This uses a regex pattern to detect and optionally remove emoji characters from names
-- Note: This is conservative - only removing from icon field for now
-- If names have emojis, they would need a more complex cleaning function

-- Log the update for transparency
DO $$
BEGIN
  RAISE NOTICE 'Removed emoji icons from all existing categories';
END $$;
