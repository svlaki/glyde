-- Migration to refactor from public.events to per-user schema events with archetype support
-- This migration will update existing user schema event tables to include archetype functionality

-- Step 1: Update the create_user_schema_rpc function to include archetype columns
CREATE OR REPLACE FUNCTION public.create_user_schema_rpc(
  user_id UUID,
  user_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schema_name TEXT;
BEGIN
  -- Remove hyphens from UUID to create schema name
  schema_name := 'u_' || REPLACE(user_id::text, '-', '');
  
  -- Create schema if it doesn't exist
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  
  -- Create events table if it doesn't exist (with archetype support)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_starts_at TIMESTAMPTZ NOT NULL,
      event_ends_at TIMESTAMPTZ NOT NULL,
      event_title TEXT NOT NULL,
      event_location TEXT,
      event_description TEXT,
      color TEXT DEFAULT ''#3B82F6'',
      recurrence JSONB,
      archetype TEXT DEFAULT ''generic'',
      archetype_data JSONB DEFAULT ''{}'',
      event_created_at TIMESTAMPTZ DEFAULT now(),
      event_updated_at TIMESTAMPTZ DEFAULT now()
    )', schema_name);
  
  -- Create chat_messages table if it doesn't exist
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL,
      user_id UUID NOT NULL,
      content TEXT NOT NULL,
      embedding vector(1536),
      sender TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    )', schema_name);
  
  -- Create settings table if it doesn't exist
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.settings (
      key TEXT PRIMARY KEY,
      value JSONB
    )', schema_name);
  
  -- Set up RLS policies if not already set
  -- Enable RLS on events table
  EXECUTE format('ALTER TABLE %I.events ENABLE ROW LEVEL SECURITY', schema_name);
  
  -- Drop and recreate the policy to avoid duplicate errors
  EXECUTE format('DROP POLICY IF EXISTS user_events ON %I.events;', schema_name);
  EXECUTE format('CREATE POLICY user_events ON %I.events FOR ALL TO authenticated USING (auth.uid() = ''%s''::uuid);', schema_name, user_id);
  
  -- Insert or update user info in public.profile table
  INSERT INTO public.profile (id, email)
  VALUES (user_id, user_email)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating user schema: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Step 2: Create function to add archetype columns to existing user event tables
CREATE OR REPLACE FUNCTION public.add_archetype_columns_to_user_tables()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  user_schema_name TEXT;
BEGIN
  -- Loop through all users in the profile table
  FOR user_record IN 
    SELECT id FROM public.profile
  LOOP
    user_schema_name := 'u_' || REPLACE(user_record.id::text, '-', '');
    
    -- Check if schema exists
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = user_schema_name) THEN
      -- Add archetype columns if they don't exist
      BEGIN
        EXECUTE format('ALTER TABLE %I.events ADD COLUMN IF NOT EXISTS color TEXT DEFAULT ''#3B82F6''', user_schema_name);
        EXECUTE format('ALTER TABLE %I.events ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT ''generic''', user_schema_name);
        EXECUTE format('ALTER TABLE %I.events ADD COLUMN IF NOT EXISTS archetype_data JSONB DEFAULT ''{}''', user_schema_name);
        
        RAISE NOTICE 'Added archetype columns to schema %', user_schema_name;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Error adding columns to schema %: %', user_schema_name, SQLERRM;
          CONTINUE;
      END;
    END IF;
  END LOOP;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error adding archetype columns: %', SQLERRM;
END;
$$;

-- Step 3: Execute the function to add archetype columns to existing user tables
SELECT public.add_archetype_columns_to_user_tables();

-- Step 4: Update existing RPC functions to support archetype data

-- Updated get_user_events function
CREATE OR REPLACE FUNCTION public.get_user_events(
  user_schema TEXT,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_text TEXT;
  result jsonb;
BEGIN
  -- Build dynamic query to access the user's schema with archetype support
  query_text := format('
    SELECT 
      jsonb_build_object(
        ''id'', e.id,
        ''event_title'', e.event_title,
        ''event_starts_at'', e.event_starts_at,
        ''event_ends_at'', e.event_ends_at,
        ''event_location'', e.event_location,
        ''event_description'', e.event_description,
        ''color'', COALESCE(e.color, public.get_event_archetype_color(COALESCE(e.archetype, ''generic''), COALESCE(e.archetype_data, ''{}''::jsonb))),
        ''archetype'', COALESCE(e.archetype, ''generic''),
        ''archetype_data'', COALESCE(e.archetype_data, ''{}''::jsonb),
        ''event_created_at'', e.event_created_at,
        ''event_updated_at'', e.event_updated_at
      )
    FROM %I.events e
    WHERE 1=1
  ', user_schema);
  
  -- Add date filters if provided
  IF start_date IS NOT NULL THEN
    query_text := query_text || format(' AND e.event_starts_at >= %L', start_date);
  END IF;
  
  IF end_date IS NOT NULL THEN
    query_text := query_text || format(' AND e.event_ends_at <= %L', end_date);
  END IF;
  
  -- Add ordering
  query_text := query_text || ' ORDER BY e.event_starts_at ASC';
  
  -- Return results
  FOR result IN EXECUTE query_text
  LOOP
    RETURN NEXT result;
  END LOOP;
  
  RETURN;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error fetching events: %', SQLERRM;
END;
$$;

-- Updated create_user_event function with archetype support
CREATE OR REPLACE FUNCTION public.create_user_event(
  user_schema TEXT,
  event_title TEXT,
  event_starts_at TIMESTAMPTZ,
  event_ends_at TIMESTAMPTZ,
  event_location TEXT DEFAULT NULL,
  event_description TEXT DEFAULT NULL,
  archetype TEXT DEFAULT NULL,
  archetype_data JSONB DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_text TEXT;
  result jsonb;
  suggested_archetype TEXT;
  archetype_color TEXT;
BEGIN
  -- Auto-suggest archetype if not provided
  suggested_archetype := COALESCE(archetype, public.suggest_event_archetype(event_title, event_description));
  
  -- Get archetype color
  archetype_color := public.get_event_archetype_color(suggested_archetype, archetype_data);
  
  -- Build dynamic query to insert into the user's schema
  query_text := format('
    INSERT INTO %I.events (
      event_title, 
      event_starts_at, 
      event_ends_at, 
      event_location, 
      event_description,
      archetype,
      archetype_data,
      color
    ) VALUES (
      %L, %L, %L, %L, %L, %L, %L, %L
    )
    RETURNING 
      jsonb_build_object(
        ''id'', id,
        ''event_title'', event_title,
        ''event_starts_at'', event_starts_at,
        ''event_ends_at'', event_ends_at,
        ''event_location'', event_location,
        ''event_description'', event_description,
        ''color'', color,
        ''archetype'', archetype,
        ''archetype_data'', archetype_data,
        ''event_created_at'', event_created_at,
        ''event_updated_at'', event_updated_at
      )
  ', 
  user_schema, 
  event_title, 
  event_starts_at, 
  event_ends_at, 
  event_location, 
  event_description,
  suggested_archetype,
  archetype_data,
  archetype_color);
  
  -- Execute the query and get the result
  EXECUTE query_text INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating event: %', SQLERRM;
END;
$$;

-- Updated update_user_event function with archetype support
CREATE OR REPLACE FUNCTION public.update_user_event(
  user_schema TEXT,
  event_id UUID,
  event_title TEXT DEFAULT NULL,
  event_starts_at TIMESTAMPTZ DEFAULT NULL,
  event_ends_at TIMESTAMPTZ DEFAULT NULL,
  event_location TEXT DEFAULT NULL,
  event_description TEXT DEFAULT NULL,
  archetype TEXT DEFAULT NULL,
  archetype_data JSONB DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_text TEXT;
  result jsonb;
  new_archetype TEXT;
  archetype_color TEXT;
BEGIN
  -- If archetype is being updated, get the color
  IF archetype IS NOT NULL THEN
    new_archetype := archetype;
    archetype_color := public.get_event_archetype_color(archetype, COALESCE(archetype_data, '{}'::jsonb));
  END IF;
  
  query_text := format('
    UPDATE %I.events SET
      event_title = COALESCE(%L, event_title),
      event_starts_at = COALESCE(%L, event_starts_at),
      event_ends_at = COALESCE(%L, event_ends_at),
      event_location = COALESCE(%L, event_location),
      event_description = COALESCE(%L, event_description),
      archetype = COALESCE(%L, archetype),
      archetype_data = COALESCE(%L, archetype_data),
      color = CASE WHEN %L IS NOT NULL THEN %L ELSE color END,
      event_updated_at = now()
    WHERE id = %L
    RETURNING 
      jsonb_build_object(
        ''id'', id,
        ''event_title'', event_title,
        ''event_starts_at'', event_starts_at,
        ''event_ends_at'', event_ends_at,
        ''event_location'', event_location,
        ''event_description'', event_description,
        ''color'', color,
        ''archetype'', archetype,
        ''archetype_data'', archetype_data,
        ''event_created_at'', event_created_at,
        ''event_updated_at'', event_updated_at
      )
  ', 
  user_schema, 
  event_title, 
  event_starts_at, 
  event_ends_at, 
  event_location, 
  event_description,
  new_archetype,
  archetype_data,
  new_archetype, -- for the CASE condition
  archetype_color,
  event_id);
  
  EXECUTE query_text INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating event: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users for new/updated functions
GRANT EXECUTE ON FUNCTION public.get_user_events(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_event(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_event(TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_archetype_columns_to_user_tables() TO authenticated;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS public.add_archetype_columns_to_user_tables;