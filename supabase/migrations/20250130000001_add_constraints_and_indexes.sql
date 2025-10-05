-- Add constraints and indexes for better performance and data integrity
-- This migration adds important constraints and indexes that were missing

-- Add constraints to prevent invalid data
ALTER TABLE events 
ADD CONSTRAINT events_start_before_end 
CHECK (start_time < end_time);

ALTER TABLE events 
ADD CONSTRAINT events_title_not_empty 
CHECK (length(trim(title)) > 0);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_user_id_start_time 
ON events (user_id, start_time);

CREATE INDEX IF NOT EXISTS idx_events_user_id_category 
ON events (user_id, category);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id_status 
ON tasks (user_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id_due_date 
ON tasks (user_id, due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goals_user_id_status 
ON goals (user_id, status);

CREATE INDEX IF NOT EXISTS idx_goals_user_id_category 
ON goals (user_id, category);

CREATE INDEX IF NOT EXISTS idx_categories_user_id_name 
ON categories (user_id, name);

-- Add constraints to prevent duplicate category names per user
ALTER TABLE categories 
ADD CONSTRAINT categories_unique_name_per_user 
UNIQUE (user_id, name);

-- Add constraints to ensure valid status values
ALTER TABLE tasks 
ADD CONSTRAINT tasks_valid_status 
CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE goals 
ADD CONSTRAINT goals_valid_status 
CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'abandoned'));

-- Add constraints to ensure valid priority values
ALTER TABLE tasks 
ADD CONSTRAINT tasks_valid_priority 
CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add constraints to ensure valid energy requirement values
ALTER TABLE tasks 
ADD CONSTRAINT tasks_valid_energy_required 
CHECK (energy_required IN ('low', 'medium', 'high'));

ALTER TABLE goals 
ADD CONSTRAINT goals_valid_energy_requirement 
CHECK (energy_requirement IN ('low', 'medium', 'high'));

-- Add constraints to ensure valid review frequency values
ALTER TABLE goals 
ADD CONSTRAINT goals_valid_review_frequency 
CHECK (review_frequency IN ('daily', 'weekly', 'monthly', 'quarterly'));

-- Add constraints to ensure progress is between 0 and 100
ALTER TABLE goals 
ADD CONSTRAINT goals_valid_progress 
CHECK (progress >= 0 AND progress <= 100);

-- Add constraints to ensure valid goal types
ALTER TABLE goals 
ADD CONSTRAINT goals_valid_goal_type 
CHECK (goal_type IN ('smart', 'okr', 'milestone', 'habit', 'project'));

-- Add constraints to ensure valid mood and confidence ratings
ALTER TABLE goal_check_ins 
ADD CONSTRAINT goal_check_ins_valid_mood_rating 
CHECK (mood_rating >= 1 AND mood_rating <= 10);

ALTER TABLE goal_check_ins 
ADD CONSTRAINT goal_check_ins_valid_confidence_level 
CHECK (confidence_level >= 1 AND confidence_level <= 10);

-- Add partial indexes for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_events_upcoming 
ON events (user_id, start_time) 
WHERE start_time > NOW();

CREATE INDEX IF NOT EXISTS idx_tasks_overdue 
ON tasks (user_id, due_date) 
WHERE status != 'completed' AND due_date < NOW();

CREATE INDEX IF NOT EXISTS idx_goals_active 
ON goals (user_id, target_date) 
WHERE status IN ('not_started', 'in_progress');

-- Add comments for documentation
COMMENT ON CONSTRAINT events_start_before_end ON events IS 'Ensures start_time is before end_time';
COMMENT ON CONSTRAINT events_title_not_empty ON events IS 'Ensures event title is not empty';
COMMENT ON CONSTRAINT categories_unique_name_per_user ON categories IS 'Prevents duplicate category names per user';
COMMENT ON CONSTRAINT tasks_valid_status ON tasks IS 'Ensures task status is valid';
COMMENT ON CONSTRAINT goals_valid_status ON goals IS 'Ensures goal status is valid';
COMMENT ON CONSTRAINT goals_valid_progress ON goals IS 'Ensures goal progress is between 0 and 100';
COMMENT ON CONSTRAINT goals_valid_goal_type ON goals IS 'Ensures goal type is valid';
