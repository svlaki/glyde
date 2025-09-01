-- Enhanced User Profile Schema for AI Agents
-- This migration adds rich contextual data fields to support Graphiti integration

-- Add new columns to profile table for agent context
ALTER TABLE profile 
ADD COLUMN IF NOT EXISTS values JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS work_patterns JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS goals_summary TEXT,
ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}';

-- Add comments to document the new columns
COMMENT ON COLUMN profile.values IS 'User core values and beliefs for agent alignment';
COMMENT ON COLUMN profile.preferences IS 'Detailed user preferences (work hours, communication style, productivity preferences)';
COMMENT ON COLUMN profile.work_patterns IS 'Productivity patterns, peak hours, energy levels, and work habits';
COMMENT ON COLUMN profile.goals_summary IS 'High-level life goals and aspirations';
COMMENT ON COLUMN profile.personality_traits IS 'Personality insights and traits for personalized interactions';
COMMENT ON COLUMN profile.context_data IS 'Additional flexible contextual information for agents';

-- Create indexes for JSONB columns to enable efficient queries
CREATE INDEX IF NOT EXISTS idx_profile_preferences_gin ON profile USING GIN (preferences);
CREATE INDEX IF NOT EXISTS idx_profile_work_patterns_gin ON profile USING GIN (work_patterns);
CREATE INDEX IF NOT EXISTS idx_profile_personality_traits_gin ON profile USING GIN (personality_traits);
CREATE INDEX IF NOT EXISTS idx_profile_context_data_gin ON profile USING GIN (context_data);

-- Example data structures (documented in comments for reference):
-- 
-- preferences structure:
-- {
--   "work_hours": {"start": "09:00", "end": "17:00", "timezone": "America/New_York"},
--   "communication": {"style": "direct", "frequency": "moderate", "preferred_channels": ["chat", "email"]},
--   "productivity": {"break_intervals": 90, "deep_work_blocks": 120, "meeting_preference": "morning"},
--   "notification_settings": {"urgent_only": false, "quiet_hours": {"start": "22:00", "end": "08:00"}}
-- }
--
-- work_patterns structure:
-- {
--   "peak_hours": [9, 10, 11, 14, 15, 16],
--   "energy_levels": {"morning": "high", "afternoon": "medium", "evening": "low"},
--   "productivity_metrics": {"focus_duration_avg": 45, "break_duration_avg": 15},
--   "meeting_patterns": {"max_per_day": 4, "preferred_duration": 30, "avoid_slots": ["12:00-13:00"]}
-- }
--
-- personality_traits structure:
-- {
--   "big_five": {"openness": 0.8, "conscientiousness": 0.9, "extraversion": 0.6, "agreeableness": 0.7, "neuroticism": 0.3},
--   "work_style": "analytical",
--   "decision_making": "deliberative",
--   "stress_indicators": ["calendar_density", "late_responses"]
-- }