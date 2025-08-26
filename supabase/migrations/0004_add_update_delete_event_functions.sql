-- Function to update an event in a user's schema
CREATE OR REPLACE FUNCTION public.update_user_event(
  user_schema TEXT,
  event_id UUID,
  event_title TEXT DEFAULT NULL,
  event_starts_at TIMESTAMPTZ DEFAULT NULL,
  event_ends_at TIMESTAMPTZ DEFAULT NULL,
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
    UPDATE %I.events SET
      event_title = COALESCE(%L, event_title),
      event_starts_at = COALESCE(%L, event_starts_at),
      event_ends_at = COALESCE(%L, event_ends_at),
      event_location = COALESCE(%L, event_location),
      event_description = COALESCE(%L, event_description),
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
  event_id);
  EXECUTE query_text INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error updating event: %'', SQLERRM;
END;
$$;

-- Function to delete an event from a user's schema
CREATE OR REPLACE FUNCTION public.delete_user_event(
  user_schema TEXT,
  event_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_text TEXT;
BEGIN
  query_text := format('
    DELETE FROM %I.events WHERE id = %L
  ', 
  user_schema,
  event_id);
  EXECUTE query_text;
  RETURN FOUND;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting event: %'', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_event TO authenticated;
