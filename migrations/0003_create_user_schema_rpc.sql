-- Create RPC function for the Edge Function to call
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
  
  -- Create events table if it doesn't exist
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