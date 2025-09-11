-- Enhanced Task System for AI Agent Integration
-- Updates per-user schema creation to include enhanced task and goal tables
-- This replaces the create_user_schema function to include new fields

-- Function to add enhanced task columns to existing user schemas
CREATE OR REPLACE FUNCTION add_enhanced_task_columns_to_user_schema(user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_schema TEXT;
BEGIN
    user_schema := 'u_' || REPLACE(user_id::TEXT, '-', '');
    
    -- Check if schema exists
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = user_schema) THEN
        -- Add new columns to existing tasks table
        EXECUTE format('ALTER TABLE %I.tasks 
            ADD COLUMN IF NOT EXISTS energy_required TEXT CHECK (energy_required IN (''low'', ''medium'', ''high'')),
            ADD COLUMN IF NOT EXISTS estimated_duration INTEGER,
            ADD COLUMN IF NOT EXISTS actual_duration INTEGER, 
            ADD COLUMN IF NOT EXISTS context_required JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS completion_notes TEXT,
            ADD COLUMN IF NOT EXISTS recurring_pattern JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS task_metadata JSONB DEFAULT ''{}''::jsonb', user_schema);
        
        -- Create indexes for efficient querying
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_energy_required ON %I.tasks (energy_required)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_estimated_duration ON %I.tasks (estimated_duration)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_actual_duration ON %I.tasks (actual_duration)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_context_required_gin ON %I.tasks USING GIN (context_required)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_recurring_pattern_gin ON %I.tasks USING GIN (recurring_pattern)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_task_metadata_gin ON %I.tasks USING GIN (task_metadata)', user_schema, user_schema);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to add enhanced goal columns to existing user schemas
CREATE OR REPLACE FUNCTION add_enhanced_goal_columns_to_user_schema(user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_schema TEXT;
BEGIN
    user_schema := 'u_' || REPLACE(user_id::TEXT, '-', '');
    
    -- Check if schema exists
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = user_schema) THEN
        -- Add new columns to existing goals table
        EXECUTE format('ALTER TABLE %I.goals 
            ADD COLUMN IF NOT EXISTS goal_type TEXT CHECK (goal_type IN (''SMART'', ''OKR'', ''milestone'', ''habit'', ''project'')) DEFAULT ''SMART'',
            ADD COLUMN IF NOT EXISTS parent_goal_id UUID,
            ADD COLUMN IF NOT EXISTS key_results JSONB DEFAULT ''[]''::jsonb,
            ADD COLUMN IF NOT EXISTS blockers JSONB DEFAULT ''[]''::jsonb,
            ADD COLUMN IF NOT EXISTS resources_needed JSONB DEFAULT ''[]''::jsonb,
            ADD COLUMN IF NOT EXISTS reflection_prompts JSONB DEFAULT ''{}''::jsonb,
            ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 5 CHECK (priority_score >= 1 AND priority_score <= 10),
            ADD COLUMN IF NOT EXISTS energy_requirement TEXT CHECK (energy_requirement IN (''low'', ''medium'', ''high'')),
            ADD COLUMN IF NOT EXISTS review_frequency TEXT CHECK (review_frequency IN (''daily'', ''weekly'', ''monthly'', ''quarterly'')) DEFAULT ''weekly''', user_schema);
        
        -- Create goal_check_ins table in user schema
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.goal_check_ins (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            goal_id UUID NOT NULL,
            user_id UUID NOT NULL,
            check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
            progress_update TEXT,
            mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5),
            confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
            obstacles_encountered JSONB DEFAULT ''[]''::jsonb,
            wins_and_progress JSONB DEFAULT ''[]''::jsonb,
            next_steps JSONB DEFAULT ''[]''::jsonb,
            reflection_notes TEXT,
            agent_insights JSONB DEFAULT ''{}''::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )', user_schema);
        
        -- Create indexes for goals
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_goal_type ON %I.goals (goal_type)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_parent_goal_id ON %I.goals (parent_goal_id)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_priority_score ON %I.goals (priority_score)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_energy_requirement ON %I.goals (energy_requirement)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_key_results_gin ON %I.goals USING GIN (key_results)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_blockers_gin ON %I.goals USING GIN (blockers)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_reflection_prompts_gin ON %I.goals USING GIN (reflection_prompts)', user_schema, user_schema);
        
        -- Create indexes for goal_check_ins
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_goal_id ON %I.goal_check_ins (goal_id)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_user_id ON %I.goal_check_ins (user_id)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_date ON %I.goal_check_ins (check_in_date)', user_schema, user_schema);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_agent_insights_gin ON %I.goal_check_ins USING GIN (agent_insights)', user_schema, user_schema);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Updated create_user_schema function with enhanced tables
CREATE OR REPLACE FUNCTION create_user_schema(user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_schema TEXT;
BEGIN
    user_schema := 'u_' || REPLACE(user_id::TEXT, '-', '');
    
    -- Create schema if it doesn't exist
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', user_schema);
    
    -- Create events table (existing functionality)
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        event_title TEXT NOT NULL,
        event_description TEXT,
        event_starts_at TIMESTAMPTZ NOT NULL,
        event_ends_at TIMESTAMPTZ NOT NULL,
        event_location TEXT,
        event_created_at TIMESTAMPTZ DEFAULT NOW(),
        event_updated_at TIMESTAMPTZ DEFAULT NOW(),
        color TEXT DEFAULT ''#3b82f6'',
        archetype TEXT DEFAULT ''generic'',
        archetype_data JSONB DEFAULT ''{}''::jsonb,
        embedding VECTOR(1536)
    )', user_schema);
    
    -- Create enhanced tasks table
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT ''personal'',
        due_date TIMESTAMPTZ,
        priority TEXT DEFAULT ''medium'' CHECK (priority IN (''low'', ''medium'', ''high'', ''urgent'')),
        status TEXT DEFAULT ''pending'' CHECK (status IN (''pending'', ''in_progress'', ''completed'', ''cancelled'')),
        completed_at TIMESTAMPTZ,
        parent_goal_id UUID,
        color TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        energy_required TEXT CHECK (energy_required IN (''low'', ''medium'', ''high'')),
        estimated_duration INTEGER,
        actual_duration INTEGER,
        context_required JSONB DEFAULT ''{}''::jsonb,
        completion_notes TEXT,
        recurring_pattern JSONB DEFAULT ''{}''::jsonb,
        task_metadata JSONB DEFAULT ''{}''::jsonb
    )', user_schema);
    
    -- Create enhanced goals table  
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT ''personal'',
        target_date TIMESTAMPTZ,
        status TEXT DEFAULT ''active'' CHECK (status IN (''active'', ''completed'', ''paused'', ''abandoned'')),
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        milestones JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        goal_type TEXT CHECK (goal_type IN (''SMART'', ''OKR'', ''milestone'', ''habit'', ''project'')) DEFAULT ''SMART'',
        parent_goal_id UUID,
        key_results JSONB DEFAULT ''[]''::jsonb,
        blockers JSONB DEFAULT ''[]''::jsonb,
        resources_needed JSONB DEFAULT ''[]''::jsonb,
        reflection_prompts JSONB DEFAULT ''{}''::jsonb,
        priority_score INTEGER DEFAULT 5 CHECK (priority_score >= 1 AND priority_score <= 10),
        energy_requirement TEXT CHECK (energy_requirement IN (''low'', ''medium'', ''high'')),
        review_frequency TEXT CHECK (review_frequency IN (''daily'', ''weekly'', ''monthly'', ''quarterly'')) DEFAULT ''weekly''
    )', user_schema);
    
    -- Create goal_check_ins table in user schema
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.goal_check_ins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id UUID NOT NULL,
        user_id UUID NOT NULL,
        check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
        progress_update TEXT,
        mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5),
        confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
        obstacles_encountered JSONB DEFAULT ''[]''::jsonb,
        wins_and_progress JSONB DEFAULT ''[]''::jsonb,
        next_steps JSONB DEFAULT ''[]''::jsonb,
        reflection_notes TEXT,
        agent_insights JSONB DEFAULT ''{}''::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )', user_schema);
    
    -- Create all indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_events_user_id ON %I.events (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_events_starts_at ON %I.events (event_starts_at)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_events_embedding ON %I.events USING ivfflat (embedding vector_cosine_ops)', user_schema, user_schema);
    
    -- Task indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_user_id ON %I.tasks (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_status ON %I.tasks (status)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_due_date ON %I.tasks (due_date)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_energy_required ON %I.tasks (energy_required)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_estimated_duration ON %I.tasks (estimated_duration)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_actual_duration ON %I.tasks (actual_duration)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_context_required_gin ON %I.tasks USING GIN (context_required)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_recurring_pattern_gin ON %I.tasks USING GIN (recurring_pattern)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_task_metadata_gin ON %I.tasks USING GIN (task_metadata)', user_schema, user_schema);
    
    -- Goal indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_user_id ON %I.goals (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_status ON %I.goals (status)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_target_date ON %I.goals (target_date)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_goal_type ON %I.goals (goal_type)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_parent_goal_id ON %I.goals (parent_goal_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_priority_score ON %I.goals (priority_score)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_energy_requirement ON %I.goals (energy_requirement)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_key_results_gin ON %I.goals USING GIN (key_results)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_blockers_gin ON %I.goals USING GIN (blockers)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_reflection_prompts_gin ON %I.goals USING GIN (reflection_prompts)', user_schema, user_schema);
    
    -- Goal check-in indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_goal_id ON %I.goal_check_ins (goal_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_user_id ON %I.goal_check_ins (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_date ON %I.goal_check_ins (check_in_date)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_agent_insights_gin ON %I.goal_check_ins USING GIN (agent_insights)', user_schema, user_schema);
    
END;
$$ LANGUAGE plpgsql;

-- Apply enhancements to existing user schemas
-- This will be run manually for existing users:
-- SELECT add_enhanced_task_columns_to_user_schema(id) FROM auth.users;
-- SELECT add_enhanced_goal_columns_to_user_schema(id) FROM auth.users;

-- Example data structures (documented in comments):
--
-- context_required structure:
-- {
--   "prerequisites": ["Setup development environment", "Review requirements"],
--   "dependencies": ["task_uuid_1", "task_uuid_2"],
--   "resources_needed": ["laptop", "design_files", "api_access"],
--   "optimal_conditions": {"time_of_day": "morning", "environment": "quiet", "tools": ["vscode", "figma"]}
-- }
--
-- recurring_pattern structure:
-- {
--   "type": "weekly", // daily, weekly, monthly, custom
--   "interval": 2, // every 2 weeks
--   "days_of_week": [1, 3, 5], // Monday, Wednesday, Friday
--   "time_of_day": "09:00",
--   "end_date": "2024-12-31",
--   "exceptions": ["2024-11-28", "2024-12-25"]
-- }
--
-- task_metadata structure:
-- {
--   "project_id": "proj_123",
--   "client": "Acme Corp",
--   "difficulty": 7,
--   "learning_opportunity": true,
--   "collaboration_type": "solo", // solo, pair, team
--   "external_tools": ["slack", "jira", "github"],
--   "success_metrics": {"code_quality": "high", "time_efficiency": "medium"}
-- }