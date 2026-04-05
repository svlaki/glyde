-- Create action_suggestions table (time-agnostic backlog of suggested activities)
CREATE TABLE public.action_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('goal_step', 'task_step', 'prep_step', 'habit', 'general')),
    source_entity_type TEXT CHECK (source_entity_type IN ('goal', 'task', 'event', 'aspect', NULL)),
    source_entity_id UUID,
    aspect_id UUID REFERENCES public.aspects(id) ON DELETE SET NULL,
    estimated_minutes INTEGER CHECK (estimated_minutes > 0 AND estimated_minutes <= 480),
    energy_level TEXT CHECK (energy_level IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'completed', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create placement_slots table (calendar blocks showing suggestions)
CREATE TABLE public.placement_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    suggestion_id UUID NOT NULL REFERENCES public.action_suggestions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'edited', 'confirmed', 'dismissed', 'expired')),
    source_agent TEXT,
    reasoning TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    confirmed_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_slot_times CHECK (end_time > start_time)
);

-- Create slot_feedback table (tracks user actions on slots for learning)
CREATE TABLE public.slot_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES public.placement_slots(id) ON DELETE CASCADE,
    suggestion_id UUID REFERENCES public.action_suggestions(id) ON DELETE SET NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('confirm', 'dismiss', 'swap', 'resize', 'drag')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_action_suggestions_user_status ON public.action_suggestions(user_id, status);
CREATE INDEX idx_action_suggestions_aspect ON public.action_suggestions(aspect_id);
CREATE INDEX idx_action_suggestions_source ON public.action_suggestions(source_entity_type, source_entity_id);

CREATE INDEX idx_placement_slots_user_status ON public.placement_slots(user_id, status);
CREATE INDEX idx_placement_slots_time_range ON public.placement_slots(user_id, start_time, end_time);
CREATE INDEX idx_placement_slots_suggestion ON public.placement_slots(suggestion_id);

CREATE INDEX idx_slot_feedback_user ON public.slot_feedback(user_id);
CREATE INDEX idx_slot_feedback_slot ON public.slot_feedback(slot_id);

-- Enable RLS
ALTER TABLE public.action_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for action_suggestions
CREATE POLICY "Users can view their own suggestions" ON public.action_suggestions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own suggestions" ON public.action_suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own suggestions" ON public.action_suggestions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own suggestions" ON public.action_suggestions
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for placement_slots
CREATE POLICY "Users can view their own slots" ON public.placement_slots
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own slots" ON public.placement_slots
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own slots" ON public.placement_slots
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own slots" ON public.placement_slots
    FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for slot_feedback
CREATE POLICY "Users can view their own feedback" ON public.slot_feedback
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own feedback" ON public.slot_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypass policies (for agent operations)
CREATE POLICY "Service role full access to suggestions" ON public.action_suggestions
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to slots" ON public.placement_slots
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to feedback" ON public.slot_feedback
    FOR ALL USING (auth.role() = 'service_role');

-- RPC: Get slots with suggestion details for a date range
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

-- Function to cleanup expired slots
CREATE OR REPLACE FUNCTION cleanup_expired_slots()
RETURNS void AS $$
BEGIN
    UPDATE public.placement_slots
    SET status = 'expired'
    WHERE status IN ('proposed', 'edited')
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
