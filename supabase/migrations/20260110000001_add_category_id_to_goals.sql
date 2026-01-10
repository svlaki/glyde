-- Add category_id column to goals table in per-user schemas
-- This allows goals to be linked to aspects/categories via foreign key

-- Function to add category_id column to goals table in user schema
CREATE OR REPLACE FUNCTION add_category_id_to_goals(user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_schema TEXT;
BEGIN
    user_schema := 'u_' || REPLACE(user_id::TEXT, '-', '');

    -- Skip if schema doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = user_schema) THEN
        RETURN;
    END IF;

    -- Check if goals table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = user_schema AND table_name = 'goals'
    ) THEN
        RETURN;
    END IF;

    -- Add category_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = user_schema
        AND table_name = 'goals'
        AND column_name = 'category_id'
    ) THEN
        EXECUTE format('ALTER TABLE %I.goals ADD COLUMN category_id UUID', user_schema);

        -- Create index for faster lookups
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_category_id ON %I.goals (category_id)', user_schema, user_schema);

        RAISE NOTICE 'Added category_id column to %.goals', user_schema;
    ELSE
        RAISE NOTICE 'category_id column already exists in %.goals', user_schema;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Also add to public.goals table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'goals'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'goals'
            AND column_name = 'category_id'
        ) THEN
            ALTER TABLE public.goals ADD COLUMN category_id UUID;
            CREATE INDEX IF NOT EXISTS idx_public_goals_category_id ON public.goals (category_id);
            RAISE NOTICE 'Added category_id column to public.goals';
        END IF;
    END IF;
END $$;

-- Apply to all existing user schemas
DO $$
DECLARE
    user_rec RECORD;
    user_uuid UUID;
BEGIN
    FOR user_rec IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name LIKE 'u_%' AND schema_name != 'u_test'
    LOOP
        -- Extract UUID from schema name (format: u_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX)
        BEGIN
            -- Convert schema name back to UUID format
            user_uuid := REPLACE(
                SUBSTRING(user_rec.schema_name FROM 3),
                '',
                ''
            )::UUID;
        EXCEPTION WHEN OTHERS THEN
            -- If we can't parse it, try a different approach
            BEGIN
                -- The schema name is u_ followed by UUID without dashes
                -- We need to reconstruct the UUID with dashes
                DECLARE
                    uuid_part TEXT;
                BEGIN
                    uuid_part := SUBSTRING(user_rec.schema_name FROM 3);
                    -- UUID format: 8-4-4-4-12
                    user_uuid := (
                        SUBSTRING(uuid_part, 1, 8) || '-' ||
                        SUBSTRING(uuid_part, 9, 4) || '-' ||
                        SUBSTRING(uuid_part, 13, 4) || '-' ||
                        SUBSTRING(uuid_part, 17, 4) || '-' ||
                        SUBSTRING(uuid_part, 21, 12)
                    )::UUID;
                END;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not parse UUID from schema: %, skipping', user_rec.schema_name;
                CONTINUE;
            END;
        END;

        RAISE NOTICE 'Processing schema: %', user_rec.schema_name;
        PERFORM add_category_id_to_goals(user_uuid);
    END LOOP;
END $$;

-- Update the create_user_tasks_goals_tables function to include category_id
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
        category_id UUID,
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

    -- Create goals table if it doesn't exist (now with category_id)
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT ''personal'',
        category_id UUID,
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
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tasks_category_id ON %I.tasks (category_id)', user_schema, user_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_user_id ON %I.goals (user_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_status ON %I.goals (status)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_target_date ON %I.goals (target_date)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goals_category_id ON %I.goals (category_id)', user_schema, user_schema);

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_goal_id ON %I.goal_check_ins (goal_id)', user_schema, user_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_goal_check_ins_user_id ON %I.goal_check_ins (user_id)', user_schema, user_schema);

END;
$$ LANGUAGE plpgsql;
