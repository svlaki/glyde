-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('system', 'custom')) DEFAULT 'system',
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  color TEXT NOT NULL, -- Hex color code
  icon TEXT, -- Emoji or icon name
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_categories table for user-specific settings
CREATE TABLE IF NOT EXISTS public.user_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  custom_color TEXT, -- User can override color
  custom_name TEXT, -- User can rename category
  notes TEXT, -- Category-specific notes for AI
  preferences JSONB DEFAULT '{}', -- Category-specific settings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

-- Add category fields to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS energy_required TEXT CHECK (energy_required IN ('low', 'medium', 'high')) DEFAULT 'medium';

-- Insert default system categories
INSERT INTO public.categories (name, type, color, icon, display_order) VALUES
  ('Work', 'system', '#3B82F6', NULL, 1),
  ('Health', 'system', '#10B981', NULL, 2),
  ('Personal', 'system', '#8B5CF6', NULL, 3),
  ('Learning', 'system', '#F59E0B', NULL, 4),
  ('Finance', 'system', '#EF4444', NULL, 5)
ON CONFLICT DO NOTHING;

-- Insert subcategories for Work
INSERT INTO public.categories (name, type, parent_id, color, icon, display_order)
SELECT 
  subcategory.name,
  'system',
  parent.id,
  subcategory.color,
  subcategory.icon,
  subcategory.display_order
FROM (
  VALUES
    ('Meeting', '#60A5FA', NULL, 1),
    ('Deep Work', '#2563EB', NULL, 2),
    ('Project', '#1E40AF', NULL, 3),
    ('Deadline', '#DC2626', NULL, 4)
) AS subcategory(name, color, icon, display_order)
CROSS JOIN public.categories parent
WHERE parent.name = 'Work' AND parent.parent_id IS NULL;

-- Insert subcategories for Health
INSERT INTO public.categories (name, type, parent_id, color, icon, display_order)
SELECT 
  subcategory.name,
  'system',
  parent.id,
  subcategory.color,
  subcategory.icon,
  subcategory.display_order
FROM (
  VALUES
    ('Exercise', '#34D399', NULL, 1),
    ('Medical', '#059669', NULL, 2),
    ('Wellness', '#6EE7B7', NULL, 3),
    ('Nutrition', '#10B981', NULL, 4)
) AS subcategory(name, color, icon, display_order)
CROSS JOIN public.categories parent
WHERE parent.name = 'Health' AND parent.parent_id IS NULL;

-- Insert subcategories for Personal
INSERT INTO public.categories (name, type, parent_id, color, icon, display_order)
SELECT 
  subcategory.name,
  'system',
  parent.id,
  subcategory.color,
  subcategory.icon,
  subcategory.display_order
FROM (
  VALUES
    ('Family', '#A78BFA', NULL, 1),
    ('Social', '#C084FC', NULL, 2),
    ('Hobbies', '#9333EA', NULL, 3),
    ('Entertainment', '#7C3AED', NULL, 4)
) AS subcategory(name, color, icon, display_order)
CROSS JOIN public.categories parent
WHERE parent.name = 'Personal' AND parent.parent_id IS NULL;

-- Create function to get category with color
CREATE OR REPLACE FUNCTION public.get_event_category_color(event_id UUID)
RETURNS TEXT AS $$
DECLARE
  category_color TEXT;
BEGIN
  SELECT c.color INTO category_color
  FROM public.events e
  JOIN public.categories c ON e.category_id = c.id
  WHERE e.id = event_id;

  RETURN COALESCE(category_color, '#6B7280'); -- Default gray if no category
END;
$$ LANGUAGE plpgsql;

-- Create function to auto-assign category based on title/description
CREATE OR REPLACE FUNCTION public.suggest_category(
  event_title TEXT,
  event_description TEXT DEFAULT NULL,
  event_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  suggested_category_id UUID;
  title_lower TEXT;
  desc_lower TEXT;
BEGIN
  title_lower := LOWER(event_title);
  desc_lower := LOWER(COALESCE(event_description, ''));
  
  -- Work patterns
  IF title_lower ~ '(meeting|standup|sync|call|review|presentation|interview|1:1|one on one|sprint|retro)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Meeting' AND parent_id IS NOT NULL;
    
  ELSIF title_lower ~ '(work|project|task|deadline|development|coding|design|research)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Deep Work' AND parent_id IS NOT NULL;
    
  -- Health patterns  
  ELSIF title_lower ~ '(gym|workout|exercise|run|walk|yoga|training|fitness)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Exercise' AND parent_id IS NOT NULL;
    
  ELSIF title_lower ~ '(doctor|dentist|appointment|checkup|therapy|medical)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Medical' AND parent_id IS NOT NULL;
    
  -- Personal patterns
  ELSIF title_lower ~ '(lunch|dinner|breakfast|coffee|drinks|party|birthday)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Social' AND parent_id IS NOT NULL;
    
  ELSIF title_lower ~ '(movie|concert|game|show|museum|entertainment)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Entertainment' AND parent_id IS NOT NULL;
    
  -- Learning patterns
  ELSIF title_lower ~ '(course|class|study|learn|training|workshop|seminar|lecture)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Learning' AND parent_id IS NULL;
    
  -- Finance patterns
  ELSIF title_lower ~ '(budget|payment|bill|investment|finance|money|tax)' THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Finance' AND parent_id IS NULL;
    
  -- Default based on time
  ELSIF event_time IS NOT NULL THEN
    -- Business hours = likely work
    IF EXTRACT(hour FROM event_time) BETWEEN 9 AND 17 
       AND EXTRACT(dow FROM event_time) BETWEEN 1 AND 5 THEN
      SELECT id INTO suggested_category_id FROM public.categories 
      WHERE name = 'Work' AND parent_id IS NULL;
    ELSE
      SELECT id INTO suggested_category_id FROM public.categories 
      WHERE name = 'Personal' AND parent_id IS NULL;
    END IF;
  END IF;
  
  -- Default to Personal if no match
  IF suggested_category_id IS NULL THEN
    SELECT id INTO suggested_category_id FROM public.categories 
    WHERE name = 'Personal' AND parent_id IS NULL;
  END IF;
  
  RETURN suggested_category_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_category_id ON public.events(category_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON public.user_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Add RLS policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

-- Categories are readable by all authenticated users
CREATE POLICY "Categories are viewable by authenticated users" ON public.categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- User categories are only accessible by the owner
CREATE POLICY "Users can view own category settings" ON public.user_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category settings" ON public.user_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category settings" ON public.user_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category settings" ON public.user_categories
  FOR DELETE USING (auth.uid() = user_id);