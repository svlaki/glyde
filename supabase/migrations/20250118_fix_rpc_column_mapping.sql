-- Fix the update_user_event function to properly map column names
CREATE OR REPLACE FUNCTION public.update_user_event(
    user_schema text,
    event_id uuid,
    event_title text DEFAULT NULL,
    event_starts_at timestamptz DEFAULT NULL,
    event_ends_at timestamptz DEFAULT NULL,
    event_location text DEFAULT NULL,
    event_description text DEFAULT NULL,
    archetype text DEFAULT NULL,
    archetype_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    update_query text;
BEGIN
    -- Build dynamic UPDATE query with proper column mappings
    update_query := format('
        UPDATE %I.events 
        SET 
            title = COALESCE($1, title),
            start_time = COALESCE($2, start_time),
            end_time = COALESCE($3, end_time),
            location = COALESCE($4, location),
            description = COALESCE($5, description),
            updated_at = NOW()
        WHERE id = $6
        RETURNING 
            id,
            title as event_title,
            description as event_description,
            start_time as event_starts_at,
            end_time as event_ends_at,
            location as event_location,
            color,
            created_at as event_created_at,
            updated_at as event_updated_at',
        user_schema);
    
    EXECUTE update_query 
    USING event_title, event_starts_at, event_ends_at, event_location, event_description, event_id
    INTO result;
    
    IF result IS NULL THEN
        RAISE EXCEPTION 'Event not found or update failed';
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error updating event: %', SQLERRM;
END;
$$;

-- Fix the create_user_event function to properly handle colors
CREATE OR REPLACE FUNCTION public.create_user_event(
    user_schema text,
    event_title text,
    event_starts_at timestamptz,
    event_ends_at timestamptz,
    event_location text DEFAULT NULL,
    event_description text DEFAULT NULL,
    archetype text DEFAULT NULL,
    archetype_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    event_color text;
    insert_query text;
BEGIN
    -- Extract color from archetype_data if provided, otherwise use default
    event_color := COALESCE(archetype_data->>'color', '#3B82F6');
    
    -- Build dynamic INSERT query with proper column mappings
    insert_query := format('
        INSERT INTO %I.events (
            title,
            description,
            start_time,
            end_time,
            location,
            color,
            created_at,
            updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, NOW(), NOW()
        )
        RETURNING 
            id,
            title as event_title,
            description as event_description,
            start_time as event_starts_at,
            end_time as event_ends_at,
            location as event_location,
            color,
            created_at as event_created_at,
            updated_at as event_updated_at',
        user_schema);
    
    EXECUTE insert_query 
    USING event_title, event_description, event_starts_at, event_ends_at, event_location, event_color
    INTO result;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error creating event: %', SQLERRM;
END;
$$;

-- Fix the get_user_events function to include color
DROP FUNCTION IF EXISTS public.get_user_events(text, timestamptz, timestamptz);
CREATE FUNCTION public.get_user_events(
    user_schema text,
    start_date timestamptz DEFAULT NULL,
    end_date timestamptz DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    event_title text,
    event_description text,
    event_starts_at timestamptz,
    event_ends_at timestamptz,
    event_location text,
    event_created_at timestamptz,
    event_updated_at timestamptz,
    color text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT 
            id,
            title as event_title,
            description as event_description,
            start_time as event_starts_at,
            end_time as event_ends_at,
            location as event_location,
            created_at as event_created_at,
            updated_at as event_updated_at,
            color
        FROM %I.events
        WHERE ($1 IS NULL OR start_time >= $1)
          AND ($2 IS NULL OR end_time <= $2)
        ORDER BY start_time ASC',
        user_schema
    ) USING start_date, end_date;
END;
$$;