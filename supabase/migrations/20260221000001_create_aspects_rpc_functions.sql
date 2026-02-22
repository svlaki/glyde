-- Migration: Create RPC functions that join on the aspects table
-- The old get_*_with_categories functions referenced the old "categories" table.
-- The backend code now calls get_*_with_aspects, which didn't exist.
-- This creates the missing functions so events, tasks, goals, and projects
-- return aspect data (name, color, icon) properly.

-- ============================================================================
-- 1. get_events_with_aspects
-- ============================================================================
DROP FUNCTION IF EXISTS get_events_with_aspects(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE FUNCTION get_events_with_aspects(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  location TEXT,
  aspect_id UUID,
  aspect_name TEXT,
  aspect_color TEXT,
  aspect_icon TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  recurrence_end TIMESTAMPTZ,
  parent_event_id UUID,
  is_recurring BOOLEAN,
  visibility TEXT,
  is_shared BOOLEAN,
  reflection TEXT,
  is_missed BOOLEAN,
  project_id UUID
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
    e.aspect_id,
    a.name as aspect_name,
    a.color as aspect_color,
    a.icon as aspect_icon,
    e.created_at,
    e.updated_at,
    e.recurrence_rule,
    e.recurrence_end,
    e.parent_event_id,
    e.is_recurring,
    e.visibility,
    COALESCE(e.is_shared, FALSE) as is_shared,
    e.reflection,
    COALESCE(e.is_missed, FALSE) as is_missed,
    e.project_id
  FROM public.events e
  LEFT JOIN public.aspects a ON e.aspect_id = a.id
  WHERE e.user_id = p_user_id
    AND e.parent_event_id IS NULL
    AND (
      (COALESCE(e.is_recurring, FALSE) = FALSE AND
       (p_start_date IS NULL OR e.start_time >= p_start_date) AND
       (p_end_date IS NULL OR e.end_time <= p_end_date))
      OR
      (e.is_recurring = TRUE AND
       e.start_time <= COALESCE(p_end_date, NOW() + INTERVAL '1 year') AND
       (e.recurrence_end IS NULL OR e.recurrence_end >= COALESCE(p_start_date, NOW() - INTERVAL '1 year')))
    )
  ORDER BY e.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_events_with_aspects(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_with_aspects(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ============================================================================
-- 2. get_tasks_with_aspects
-- ============================================================================
DROP FUNCTION IF EXISTS get_tasks_with_aspects(UUID);

CREATE FUNCTION get_tasks_with_aspects(p_user_id UUID)
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
  aspect_id UUID,
  aspect_name TEXT,
  aspect_color TEXT,
  aspect_icon TEXT,
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
    t.aspect_id,
    a.name as aspect_name,
    a.color as aspect_color,
    a.icon as aspect_icon,
    t.created_at,
    t.updated_at
  FROM public.tasks t
  LEFT JOIN public.aspects a ON t.aspect_id = a.id
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

GRANT EXECUTE ON FUNCTION get_tasks_with_aspects(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tasks_with_aspects(UUID) TO service_role;

-- ============================================================================
-- 3. get_goals_with_aspects
-- ============================================================================
DROP FUNCTION IF EXISTS get_goals_with_aspects(UUID);

CREATE FUNCTION get_goals_with_aspects(p_user_id UUID)
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
  aspect_id UUID,
  aspect_name TEXT,
  aspect_color TEXT,
  aspect_icon TEXT,
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
    g.aspect_id,
    a.name as aspect_name,
    a.color as aspect_color,
    a.icon as aspect_icon,
    g.created_at,
    g.updated_at
  FROM public.goals g
  LEFT JOIN public.aspects a ON g.aspect_id = a.id
  WHERE g.user_id = p_user_id
  ORDER BY g.priority_score DESC, g.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_goals_with_aspects(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_goals_with_aspects(UUID) TO service_role;

-- ============================================================================
-- 4. get_projects_with_aspects
-- ============================================================================
DROP FUNCTION IF EXISTS get_projects_with_aspects(UUID);

CREATE FUNCTION get_projects_with_aspects(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  description TEXT,
  deadline TIMESTAMPTZ,
  details JSONB,
  aspect_id UUID,
  aspect_name TEXT,
  aspect_color TEXT,
  aspect_icon TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.name,
    p.description,
    p.deadline,
    p.details,
    p.aspect_id,
    a.name as aspect_name,
    a.color as aspect_color,
    a.icon as aspect_icon,
    p.archived_at,
    p.created_at,
    p.updated_at
  FROM public.projects p
  LEFT JOIN public.aspects a ON p.aspect_id = a.id
  WHERE p.user_id = p_user_id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_projects_with_aspects(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_projects_with_aspects(UUID) TO service_role;
