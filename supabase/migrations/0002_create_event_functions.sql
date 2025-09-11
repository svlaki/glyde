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
  -- Build dynamic query to access the user's schema
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
  
  -- Add date filters if provided
  IF start_date IS NOT NULL THEN
    query_text := query_text || format(' AND e.event_starts_at >= %L', start_date);
  END IF;
  
  IF end_date IS NOT NULL THEN
    query_text := query_text || format(' AND e.event_ends_at <= %L', end_date);
  END IF;
  
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
  -- Build dynamic query to insert into the user's schema
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
  
  -- Execute the query and get the result
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