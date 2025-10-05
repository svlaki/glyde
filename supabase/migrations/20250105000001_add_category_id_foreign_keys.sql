-- Migration: Add category_id foreign keys to events, tasks, and goals
-- This replaces the string-based category field with proper foreign key relationships

-- Step 1: Add category_id columns to events, tasks, and goals
ALTER TABLE public.events ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Step 2: Migrate existing category names to category_id
-- For events
UPDATE public.events e
SET category_id = c.id
FROM public.categories c
WHERE e.user_id = c.user_id
  AND e.category = c.name
  AND e.category IS NOT NULL;

-- For tasks
UPDATE public.tasks t
SET category_id = c.id
FROM public.categories c
WHERE t.user_id = c.user_id
  AND t.category = c.name
  AND t.category IS NOT NULL;

-- For goals
UPDATE public.goals g
SET category_id = c.id
FROM public.categories c
WHERE g.user_id = c.user_id
  AND g.category = c.name
  AND g.category IS NOT NULL;

-- Step 3: Add indexes for performance
CREATE INDEX idx_events_category_id ON public.events(category_id);
CREATE INDEX idx_tasks_category_id ON public.tasks(category_id);
CREATE INDEX idx_goals_category_id ON public.goals(category_id);

-- Step 4: Keep old category column temporarily for backward compatibility
-- We'll deprecate it in a future migration after frontend is updated
-- Add comment to mark as deprecated
COMMENT ON COLUMN public.events.category IS 'DEPRECATED: Use category_id instead. Will be removed in future migration.';
COMMENT ON COLUMN public.tasks.category IS 'DEPRECATED: Use category_id instead. Will be removed in future migration.';
COMMENT ON COLUMN public.goals.category IS 'DEPRECATED: Use category_id instead. Will be removed in future migration.';

-- Step 5: Create helper function to get category with joined data
CREATE OR REPLACE FUNCTION get_events_with_categories(p_user_id UUID, p_start_date TIMESTAMPTZ DEFAULT NULL, p_end_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  category_icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    e.title,
    e.description,
    e.start_time,
    e.end_time,
    e.location,
    e.category_id,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon,
    e.created_at,
    e.updated_at
  FROM public.events e
  LEFT JOIN public.categories c ON e.category_id = c.id
  WHERE e.user_id = p_user_id
    AND (p_start_date IS NULL OR e.start_time >= p_start_date)
    AND (p_end_date IS NULL OR e.end_time <= p_end_date)
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_tasks_with_categories(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  parent_goal_id UUID,
  energy_required TEXT,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  category_icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.completed_at,
    t.parent_goal_id,
    t.energy_required,
    t.estimated_duration,
    t.actual_duration,
    t.category_id,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon,
    t.created_at,
    t.updated_at
  FROM public.tasks t
  LEFT JOIN public.categories c ON t.category_id = c.id
  WHERE t.user_id = p_user_id
  ORDER BY
    CASE t.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    t.due_date ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_goals_with_categories(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  progress INTEGER,
  goal_type TEXT,
  target_date TIMESTAMPTZ,
  parent_goal_id UUID,
  priority_score INTEGER,
  review_frequency TEXT,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  category_icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.user_id,
    g.title,
    g.description,
    g.status,
    g.progress,
    g.goal_type,
    g.target_date,
    g.parent_goal_id,
    g.priority_score,
    g.review_frequency,
    g.category_id,
    c.name as category_name,
    c.color as category_color,
    c.icon as category_icon,
    g.created_at,
    g.updated_at
  FROM public.goals g
  LEFT JOIN public.categories c ON g.category_id = c.id
  WHERE g.user_id = p_user_id
  ORDER BY g.priority_score DESC, g.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_events_with_categories(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tasks_with_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_goals_with_categories(UUID) TO authenticated;
