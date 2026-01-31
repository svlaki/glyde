-- Add milestones to get_goals_with_categories function
DROP FUNCTION IF EXISTS get_goals_with_categories(uuid);

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
  milestones JSONB,
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
    g.milestones,
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
