-- Fix get_slots_with_suggestions to filter out expired slots and past slots
CREATE OR REPLACE FUNCTION get_slots_with_suggestions(
    p_user_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT,
    source_agent TEXT,
    reasoning TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    confirmed_event_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    suggestion_id UUID,
    suggestion_title TEXT,
    suggestion_description TEXT,
    suggestion_type TEXT,
    estimated_minutes INTEGER,
    energy_level TEXT,
    aspect_id UUID,
    aspect_name TEXT,
    aspect_color TEXT,
    aspect_icon TEXT
) AS $$
BEGIN
    -- First, expire any slots past their expires_at
    UPDATE public.placement_slots
    SET status = 'expired'
    WHERE placement_slots.user_id = p_user_id
    AND placement_slots.status IN ('proposed', 'edited')
    AND placement_slots.expires_at IS NOT NULL
    AND placement_slots.expires_at < NOW();

    -- Also expire slots whose end_time is in the past
    UPDATE public.placement_slots
    SET status = 'expired'
    WHERE placement_slots.user_id = p_user_id
    AND placement_slots.status IN ('proposed', 'edited')
    AND placement_slots.end_time < NOW();

    RETURN QUERY
    SELECT
        ps.id,
        ps.user_id,
        ps.start_time,
        ps.end_time,
        ps.status,
        ps.source_agent,
        ps.reasoning,
        ps.expires_at,
        ps.confirmed_event_id,
        ps.created_at,
        ps.updated_at,
        s.id AS suggestion_id,
        s.title AS suggestion_title,
        s.description AS suggestion_description,
        s.suggestion_type,
        s.estimated_minutes,
        s.energy_level,
        a.id AS aspect_id,
        a.name AS aspect_name,
        a.color AS aspect_color,
        a.icon AS aspect_icon
    FROM public.placement_slots ps
    JOIN public.action_suggestions s ON ps.suggestion_id = s.id
    LEFT JOIN public.aspects a ON s.aspect_id = a.id
    WHERE ps.user_id = p_user_id
    AND ps.status IN ('proposed', 'edited')
    AND ps.start_time >= p_start_date
    AND ps.end_time <= p_end_date
    ORDER BY ps.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
