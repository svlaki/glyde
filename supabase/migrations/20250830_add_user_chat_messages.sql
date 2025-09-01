-- Function to add chat_messages table to a user schema
CREATE OR REPLACE FUNCTION add_chat_messages_to_user_schema(user_schema_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the chat_messages table in the user schema
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL,
      user_id UUID NOT NULL,
      content TEXT NOT NULL,
      sender TEXT CHECK (sender IN (''user'', ''assistant'')),
      embedding vector(1536),
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT ''{}''::jsonb
    );
  ', user_schema_name);
  
  -- Create indexes for performance
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_chat_messages_session 
    ON %I.chat_messages(session_id, timestamp);
  ', replace(user_schema_name, 'u_', ''), user_schema_name);
  
  EXECUTE format('
    CREATE INDEX IF NOT EXISTS idx_%I_chat_messages_timestamp 
    ON %I.chat_messages(timestamp DESC);
  ', replace(user_schema_name, 'u_', ''), user_schema_name);

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Failed to create chat_messages table for schema %: %', user_schema_name, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Update the existing create_user_schema_rpc function to include chat_messages
CREATE OR REPLACE FUNCTION create_user_schema_rpc(user_id UUID, user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_schema_name TEXT;
  table_exists BOOLEAN;
BEGIN
  -- Generate schema name from user_id (remove hyphens)
  user_schema_name := 'u_' || replace(user_id::text, '-', '');
  
  -- Create schema if it doesn't exist
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', user_schema_name);
  
  -- Create events table if it doesn't exist
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      location TEXT,
      color TEXT DEFAULT ''#3b82f6'',
      archetype TEXT DEFAULT ''generic'',
      archetype_data JSONB DEFAULT ''{}''::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ', user_schema_name);
  
  -- Create other required tables (tasks, goals, etc.)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT ''pending'' CHECK (status IN (''pending'', ''in_progress'', ''completed'', ''cancelled'')),
      priority TEXT DEFAULT ''medium'' CHECK (priority IN (''low'', ''medium'', ''high'', ''urgent'')),
      due_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ', user_schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT ''active'' CHECK (status IN (''active'', ''completed'', ''paused'', ''abandoned'')),
      target_date TIMESTAMPTZ,
      progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ', user_schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.goal_check_ins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      goal_id UUID,
      check_in_date DATE DEFAULT CURRENT_DATE,
      progress_update TEXT,
      mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5),
      confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  ', user_schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL,
      value JSONB DEFAULT ''{}''::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ', user_schema_name);
  
  -- Add chat_messages table using the helper function
  PERFORM add_chat_messages_to_user_schema(user_schema_name);
  
  RAISE LOG 'Successfully created user schema: %', user_schema_name;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Failed to create user schema %: %', user_schema_name, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Add chat_messages table to existing user schemas
DO $$
DECLARE
  schema_record RECORD;
BEGIN
  FOR schema_record IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'u_%'
  LOOP
    PERFORM add_chat_messages_to_user_schema(schema_record.schema_name);
  END LOOP;
END;
$$;