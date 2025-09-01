-- Migrate tasks and goals from public schema to per-user schemas
-- This creates the missing tables and migrates existing data

-- Function to create tasks and goals tables in user schema (if they don't exist)
CREATE OR REPLACE FUNCTION create_user_tasks_goals_tables(user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_schema TEXT;
BEGIN
    user_schema := 'u_' || REPLACE(user_id::TEXT, '-', '');
    
    -- Skip if schema doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = user_schema) THEN
        RETURN;
    END IF;
    
    -- Create tasks table if it doesn't exist
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
    
    -- Create goals table if it doesn't exist
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
    
    -- Create goal_check_ins table if it doesn't exist
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
    
    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_user_id ON %I.tasks (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_status ON %I.tasks (status)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_due_date ON %I.tasks (due_date)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_energy_required ON %I.tasks (energy_required)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_estimated_duration ON %I.tasks (estimated_duration)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_actual_duration ON %I.tasks (actual_duration)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_context_required_gin ON %I.tasks USING GIN (context_required)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_recurring_pattern_gin ON %I.tasks USING GIN (recurring_pattern)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_task_metadata_gin ON %I.tasks USING GIN (task_metadata)', user_schema, user_schema);
    
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
    
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_goal_id ON %I.goal_check_ins (goal_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_user_id ON %I.goal_check_ins (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_date ON %I.goal_check_ins (check_in_date)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_agent_insights_gin ON %I.goal_check_ins USING GIN (agent_insights)', user_schema, user_schema);
    
END;
$$ LANGUAGE plpgsql;

-- Function to migrate existing data from public tables to user schema
CREATE OR REPLACE FUNCTION migrate_user_tasks_goals(user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_schema TEXT;
    task_count INTEGER;
    goal_count INTEGER;
BEGIN
    user_schema := 'u_' || REPLACE(user_id::TEXT, '-', '');
    
    -- Skip if schema doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = user_schema) THEN
        RETURN;
    END IF;
    
    -- Migrate tasks
    EXECUTE format('INSERT INTO %I.tasks (id, user_id, title, description, category, due_date, priority, status, completed_at, parent_goal_id, color, created_at, updated_at)
        SELECT id, user_id, title, description, category, due_date, priority, status, completed_at, parent_goal_id, color, created_at, updated_at
        FROM public.tasks 
        WHERE user_id = $1
        ON CONFLICT (id) DO NOTHING', user_schema) USING user_id;
    
    GET DIAGNOSTICS task_count = ROW_COUNT;
    
    -- Migrate goals
    EXECUTE format('INSERT INTO %I.goals (id, user_id, title, description, category, target_date, status, progress, milestones, created_at, updated_at)
        SELECT id, user_id, title, description, category, target_date, status, progress, milestones, created_at, updated_at
        FROM public.goals 
        WHERE user_id = $1
        ON CONFLICT (id) DO NOTHING', user_schema) USING user_id;
        
    GET DIAGNOSTICS goal_count = ROW_COUNT;
    
    RAISE NOTICE 'Migrated % tasks and % goals for user %', task_count, goal_count, user_id;
END;
$$ LANGUAGE plpgsql;

-- Create tables for all existing user schemas
DO $$
DECLARE
    user_rec RECORD;
    user_uuid UUID;
BEGIN
    FOR user_rec IN 
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name LIKE 'u_%' AND schema_name != 'u_test'
    LOOP
        -- Extract UUID from schema name
        BEGIN
            user_uuid := REPLACE(REPLACE(user_rec.schema_name, 'u_', ''), '', '-')::UUID;
        EXCEPTION WHEN OTHERS THEN
            -- Skip if we can't parse the UUID
            CONTINUE;
        END;
        
        RAISE NOTICE 'Creating tables for schema: %', user_rec.schema_name;
        PERFORM create_user_tasks_goals_tables(user_uuid);
        PERFORM migrate_user_tasks_goals(user_uuid);
    END LOOP;
END $$;

-- Create a helper function to get the correct user schema table names for RPC functions
CREATE OR REPLACE FUNCTION get_user_table_name(user_id UUID, table_name TEXT)
RETURNS TEXT AS $$
DECLARE
    user_schema TEXT;
BEGIN
    user_schema := 'u_' || REPLACE(user_id::TEXT, '-', '');
    RETURN user_schema || '.' || table_name;
END;
$$ LANGUAGE plpgsql;

-- Update existing RPC functions to use per-user schemas (if they exist)
-- This will help maintain compatibility during the transition

-- Note: After running this migration, you should update your application code to:
-- 1. Use per-user schema tables instead of public.tasks and public.goals
-- 2. Update RPC functions to query the correct user schema
-- 3. Consider removing public.tasks and public.goals tables once migration is complete