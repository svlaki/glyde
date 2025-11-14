-- Create function to populate default categories for a user
CREATE OR REPLACE FUNCTION create_default_categories(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if user already has categories
  IF EXISTS (SELECT 1 FROM categories WHERE user_id = target_user_id) THEN
    RETURN;
  END IF;

  -- Insert default categories
  INSERT INTO categories (user_id, name, color, icon, description, display_order, context)
  VALUES
    -- Work & Career
    (target_user_id, 'Work', '#3b82f6', NULL, 'Work-related tasks and meetings', 1, '{"energy_required": "medium", "best_time_of_day": ["morning", "afternoon"]}'::jsonb),
    (target_user_id, 'Meetings', '#8b5cf6', NULL, 'Scheduled meetings and calls', 2, '{"typical_duration": 60, "energy_required": "medium"}'::jsonb),

    -- Personal Development
    (target_user_id, 'Personal', '#10b981', NULL, 'Personal activities and errands', 3, '{"energy_required": "low"}'::jsonb),
    (target_user_id, 'Learning', '#f59e0b', NULL, 'Education, courses, and skill development', 4, '{"energy_required": "high", "best_time_of_day": ["morning"]}'::jsonb),

    -- Health & Wellness
    (target_user_id, 'Exercise', '#ef4444', NULL, 'Workouts and physical activity', 5, '{"typical_duration": 60, "energy_required": "high", "best_time_of_day": ["morning", "evening"]}'::jsonb),
    (target_user_id, 'Health', '#ec4899', NULL, 'Medical appointments and health-related activities', 6, '{"typical_duration": 45}'::jsonb),

    -- Social & Relationships
    (target_user_id, 'Social', '#06b6d4', NULL, 'Social events and hanging out with friends', 7, '{"energy_required": "medium"}'::jsonb),
    (target_user_id, 'Family', '#f43f5e', NULL, 'Family time and activities', 8, '{"energy_required": "low"}'::jsonb),

    -- Daily Life
    (target_user_id, 'Errands', '#84cc16', NULL, 'Shopping and errands', 9, '{"typical_duration": 45, "energy_required": "low"}'::jsonb),
    (target_user_id, 'Chores', '#a855f7', NULL, 'Household chores and maintenance', 10, '{"energy_required": "low"}'::jsonb),

    -- Entertainment & Hobbies
    (target_user_id, 'Hobbies', '#14b8a6', NULL, 'Personal hobbies and creative pursuits', 11, '{"energy_required": "medium"}'::jsonb),
    (target_user_id, 'Entertainment', '#eab308', NULL, 'Movies, shows, games, and fun activities', 12, '{"energy_required": "low", "best_time_of_day": ["evening"]}'::jsonb);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_default_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_categories(UUID) TO anon;
