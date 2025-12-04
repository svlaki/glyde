-- Create unified categories system for events, tasks, and goals
-- Categories are user-defined with custom colors and context

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT,  -- Emoji or icon name
  description TEXT,

  -- Context for this category (AI can learn and user can edit)
  context JSONB DEFAULT '{
    "typical_duration": null,
    "energy_required": null,
    "best_time_of_day": [],
    "prerequisites": [],
    "related_goals": [],
    "notes": null
  }'::jsonb,

  -- Category type applies to
  applies_to JSONB DEFAULT '["events", "tasks", "goals"]'::jsonb,

  -- Display order
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique category name per user
  UNIQUE(user_id, name)
);

-- Indexes
CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_categories_name ON public.categories(user_id, name);
CREATE INDEX idx_categories_context_gin ON public.categories USING GIN (context);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can manage their own categories"
ON public.categories
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.categories TO authenticated;

-- Add comment
COMMENT ON TABLE public.categories IS
'User-defined categories for events, tasks, and goals with custom colors and AI-learnable context';

-- Create default categories for new users
-- This function will be called when a user schema is created
CREATE OR REPLACE FUNCTION create_default_categories(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, color, icon, description, applies_to, display_order)
  VALUES
    -- Core life categories
    (target_user_id, 'Work', '#3b82f6', 'W', 'Work-related activities', '["events", "tasks", "goals"]', 1),
    (target_user_id, 'School', '#8b5cf6', 'S', 'School and education', '["events", "tasks", "goals"]', 2),
    (target_user_id, 'Health & Hygiene', '#ef4444', 'H', 'Health, fitness, and personal hygiene', '["events", "tasks", "goals"]', 3),
    (target_user_id, 'Social', '#f97316', 'S', 'Social activities and relationships', '["events", "tasks"]', 4),
    (target_user_id, 'Family', '#ec4899', 'F', 'Family time and activities', '["events", "tasks"]', 5),
    (target_user_id, 'Personal', '#10b981', 'P', 'Personal errands and tasks', '["events", "tasks", "goals"]', 6),
    (target_user_id, 'Fitness', '#f59e0b', 'F', 'Exercise and physical activity', '["events", "tasks", "goals"]', 7),
    (target_user_id, 'Hobbies', '#06b6d4', 'H', 'Hobbies and creative pursuits', '["events", "tasks"]', 8),
    (target_user_id, 'Finance', '#10b981', 'F', 'Financial planning and management', '["events", "tasks", "goals"]', 9),
    (target_user_id, 'Shopping', '#78716c', 'S', 'Shopping and errands', '["events", "tasks"]', 10),
    (target_user_id, 'Travel', '#6366f1', 'T', 'Travel and trips', '["events", "tasks", "goals"]', 11),
    (target_user_id, 'Self-Care', '#ec4899', 'S', 'Relaxation and self-care', '["events", "tasks"]', 12)
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Update the create_user_schema function to include default categories
-- This will be handled in the application code

-- Function to get category for an entity
CREATE OR REPLACE FUNCTION get_category_color(target_user_id UUID, category_name TEXT)
RETURNS TEXT AS $$
DECLARE
  category_color TEXT;
BEGIN
  SELECT color INTO category_color
  FROM public.categories
  WHERE user_id = target_user_id AND name = category_name;

  RETURN COALESCE(category_color, '#6b7280');  -- Default gray
END;
$$ LANGUAGE plpgsql;

-- Function to get category context
CREATE OR REPLACE FUNCTION get_category_context(target_user_id UUID, category_name TEXT)
RETURNS JSONB AS $$
DECLARE
  category_context JSONB;
BEGIN
  SELECT context INTO category_context
  FROM public.categories
  WHERE user_id = target_user_id AND name = category_name;

  RETURN COALESCE(category_context, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Update trigger for categories
CREATE OR REPLACE FUNCTION update_category_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_timestamp
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION update_category_timestamp();
