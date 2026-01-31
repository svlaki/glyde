-- Add milestone_type column to goals tables
-- Supports two types of milestones:
-- 'dated' - Milestones with specific due dates (timeline view)
-- 'ordered' - Sequential steps without dates (numbered checklist)

-- Add to public.goals table
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS milestone_type TEXT
CHECK (milestone_type IN ('dated', 'ordered'))
DEFAULT 'dated';

-- Function to add milestone_type to existing user schema goals tables
CREATE OR REPLACE FUNCTION add_milestone_type_to_user_goals()
RETURNS VOID AS $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name LIKE 'u_%' AND schema_name != 'u_test'
    LOOP
        -- Check if goals table exists in this schema
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = schema_rec.schema_name
            AND table_name = 'goals'
        ) THEN
            -- Add milestone_type column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = schema_rec.schema_name
                AND table_name = 'goals'
                AND column_name = 'milestone_type'
            ) THEN
                EXECUTE format(
                    'ALTER TABLE %I.goals ADD COLUMN milestone_type TEXT CHECK (milestone_type IN (''dated'', ''ordered'')) DEFAULT ''dated''',
                    schema_rec.schema_name
                );
                -- Add index for milestone_type
                EXECUTE format(
                    'CREATE INDEX IF NOT EXISTS idx_%I_goals_milestone_type ON %I.goals (milestone_type)',
                    schema_rec.schema_name, schema_rec.schema_name
                );
                RAISE NOTICE 'Added milestone_type to %.goals', schema_rec.schema_name;
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to add column to all existing user schemas
SELECT add_milestone_type_to_user_goals();

-- Update the create_user_tasks_goals_tables function to include milestone_type for new users
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

    -- Create goals table if it doesn't exist (now includes milestone_type)
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
        milestone_type TEXT CHECK (milestone_type IN (''dated'', ''ordered'')) DEFAULT ''dated'',
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
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_milestone_type ON %I.goals (milestone_type)', user_schema, user_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_goal_id ON %I.goal_check_ins (goal_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_user_id ON %I.goal_check_ins (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_date ON %I.goal_check_ins (check_in_date)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_agent_insights_gin ON %I.goal_check_ins USING GIN (agent_insights)', user_schema, user_schema);

END;
$$ LANGUAGE plpgsql;

-- Add index on milestone_type for public.goals
CREATE INDEX IF NOT EXISTS idx_goals_milestone_type ON public.goals (milestone_type);
