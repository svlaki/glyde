-- Create the public.profile table (idempotent)
CREATE TABLE IF NOT EXISTS public.profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Set RLS on profile table
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles
CREATE POLICY IF NOT EXISTS "Users can view all profiles" 
  ON public.profile 
  FOR SELECT 
  USING (true);

-- Users can update only their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile" 
  ON public.profile 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Users can't delete profiles
CREATE POLICY IF NOT EXISTS "Users cannot delete profiles" 
  ON public.profile 
  FOR DELETE 
  USING (false);

-- Function to generate per-user schemas (trigger-based, for auth.users)
CREATE OR REPLACE FUNCTION create_user_schema()
RETURNS TRIGGER AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS u_%s', REPLACE(NEW.id::text, '-', ''));
  EXECUTE format('CREATE TABLE IF NOT EXISTS u_%s.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_starts_at TIMESTAMPTZ NOT NULL,
    event_ends_at TIMESTAMPTZ NOT NULL,
    event_title TEXT NOT NULL,
    event_location TEXT,
    event_description TEXT,
    recurrence JSONB,
    event_created_at TIMESTAMPTZ DEFAULT now(),
    event_updated_at TIMESTAMPTZ DEFAULT now()
  )', REPLACE(NEW.id::text, '-', ''));
  
  -- Create per-user chat_messages table for vector memory
  EXECUTE format('CREATE TABLE IF NOT EXISTS u_%s.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    sender TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
  )', REPLACE(NEW.id::text, '-', ''));
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS u_%s.settings (
    key TEXT PRIMARY KEY,
    value JSONB
  )', REPLACE(NEW.id::text, '-', ''));
  
  -- Set up RLS policies
  EXECUTE format('ALTER TABLE u_%s.events ENABLE ROW LEVEL SECURITY', REPLACE(NEW.id::text, '-', ''));
  EXECUTE format('DROP POLICY IF EXISTS user_events ON u_%s.events', REPLACE(NEW.id::text, '-', ''));
  EXECUTE format('CREATE POLICY user_events ON u_%s.events FOR ALL TO authenticated USING (auth.uid() = ''%s''::uuid)', 
    REPLACE(NEW.id::text, '-', ''), NEW.id);
  
  -- Insert user info into public.profile table
  INSERT INTO public.profile (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_schema();

-- RPC function for Edge Functions or manual schema creation
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
  schema_name := 'u_' || REPLACE(user_id::text, '-', '');
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_starts_at TIMESTAMPTZ NOT NULL,
      event_ends_at TIMESTAMPTZ NOT NULL,
      event_title TEXT NOT NULL,
      event_location TEXT,
      event_description TEXT,
      recurrence JSONB,
      event_created_at TIMESTAMPTZ DEFAULT now(),
      event_updated_at TIMESTAMPTZ DEFAULT now()
    )', schema_name);
  
  -- Create per-user chat_messages table for vector memory
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
  
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.settings (
      key TEXT PRIMARY KEY,
      value JSONB
    )', schema_name);
  EXECUTE format('ALTER TABLE %I.events ENABLE ROW LEVEL SECURITY', schema_name);
  EXECUTE format('DROP POLICY IF EXISTS user_events ON %I.events;', schema_name);
  EXECUTE format('CREATE POLICY user_events ON %I.events FOR ALL TO authenticated USING (auth.uid() = ''%s''::uuid);', schema_name, user_id);
  INSERT INTO public.profile (id, email)
  VALUES (user_id, user_email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating user schema: %', SQLERRM;
    RETURN FALSE;
END;
$$; 

-- Function to get events from a user's schema
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
  query_text := format('
    SELECT 
      jsonb_build_object(
        ''id'', e.id,
        ''event_title'', e.event_title,
        ''event_starts_at'', e.event_starts_at,
        ''event_ends_at'', e.event_ends_at,
        ''event_location'', e.event_location,
        ''event_description'', e.event_description,
        ''event_created_at'', e.event_created_at,
        ''event_updated_at'', e.event_updated_at
      )
    FROM %I.events e
    WHERE 1=1
  ', user_schema);
  IF start_date IS NOT NULL THEN
    query_text := query_text || format(' AND e.event_starts_at >= %L', start_date);
  END IF;
  IF end_date IS NOT NULL THEN
    query_text := query_text || format(' AND e.event_ends_at <= %L', end_date);
  END IF;
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

-- Function to create an event in a user's schema
CREATE OR REPLACE FUNCTION public.create_user_event(
  user_schema TEXT,
  event_title TEXT,
  event_starts_at TIMESTAMPTZ,
  event_ends_at TIMESTAMPTZ,
  event_location TEXT DEFAULT NULL,
  event_description TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_text TEXT;
  result jsonb;
BEGIN
  query_text := format('
    INSERT INTO %I.events (
      event_title, 
      event_starts_at, 
      event_ends_at, 
      event_location, 
      event_description
    ) VALUES (
      %L, %L, %L, %L, %L
    )
    RETURNING 
      jsonb_build_object(
        ''id'', id,
        ''event_title'', event_title,
        ''event_starts_at'', event_starts_at,
        ''event_ends_at'', event_ends_at,
        ''event_location'', event_location,
        ''event_description'', event_description,
        ''event_created_at'', event_created_at,
        ''event_updated_at'', event_updated_at
      )
  ', 
  user_schema, 
  event_title, 
  event_starts_at, 
  event_ends_at, 
  event_location, 
  event_description);
  EXECUTE query_text INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating event: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_event TO authenticated; 

-- Helper view for free/busy times (admin only, placeholder)
CREATE OR REPLACE VIEW public.vw_free_busy AS
SELECT 
  e.id, 
  e.event_starts_at, 
  e.event_ends_at, 
  p.display_name,
  p.id as user_id
FROM (
  SELECT 
    NULL::uuid as id, 
    NULL::timestamptz as event_starts_at, 
    NULL::timestamptz as event_ends_at,
    NULL::uuid as user_id
  WHERE false
) e
JOIN public.profile p ON e.user_id = p.id; 