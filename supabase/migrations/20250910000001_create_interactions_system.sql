-- Create user_interactions table
CREATE TABLE public.user_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('yes_no', 'multiple_choice', 'text')),
    options JSONB DEFAULT '[]'::jsonb,
    event_data JSONB DEFAULT '{}'::jsonb,
    priority INTEGER DEFAULT 5,
    category TEXT DEFAULT 'general',
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '4 hours') NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'responded', 'expired', 'dismissed'))
);

-- Create interaction_responses table
CREATE TABLE public.interaction_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interaction_id UUID NOT NULL REFERENCES public.user_interactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    response JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_user_interactions_user_id_status ON public.user_interactions(user_id, status);
CREATE INDEX idx_user_interactions_created_at ON public.user_interactions(created_at);
CREATE INDEX idx_user_interactions_expires_at ON public.user_interactions(expires_at);
CREATE INDEX idx_interaction_responses_interaction_id ON public.interaction_responses(interaction_id);
CREATE INDEX idx_interaction_responses_user_id ON public.interaction_responses(user_id);

-- Add unique constraint to prevent duplicate active interactions
CREATE UNIQUE INDEX idx_unique_active_interaction 
ON public.user_interactions(user_id, question, type) 
WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_interactions
CREATE POLICY "Users can view their own interactions" ON public.user_interactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions" ON public.user_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions" ON public.user_interactions
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for interaction_responses
CREATE POLICY "Users can view their own interaction responses" ON public.interaction_responses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interaction responses" ON public.interaction_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to cleanup expired interactions
CREATE OR REPLACE FUNCTION cleanup_expired_interactions()
RETURNS void AS $$
BEGIN
    UPDATE public.user_interactions 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get active interactions for a user
CREATE OR REPLACE FUNCTION get_user_active_interactions(target_user_id UUID)
RETURNS TABLE (
    id UUID,
    question TEXT,
    type TEXT,
    options JSONB,
    event_data JSONB,
    priority INTEGER,
    category TEXT,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- First cleanup expired interactions
    PERFORM cleanup_expired_interactions();
    
    -- Return active interactions
    RETURN QUERY
    SELECT 
        i.id,
        i.question,
        i.type,
        i.options,
        i.event_data,
        i.priority,
        i.category,
        i.context,
        i.created_at,
        i.expires_at
    FROM public.user_interactions i
    WHERE i.user_id = target_user_id 
    AND i.status = 'active'
    ORDER BY i.priority DESC, i.created_at ASC
    LIMIT 2; -- Max 2 active interactions
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to respond to an interaction
CREATE OR REPLACE FUNCTION respond_to_interaction(
    target_interaction_id UUID,
    target_user_id UUID,
    user_response JSONB
)
RETURNS JSONB AS $$
DECLARE
    interaction_record RECORD;
    response_id UUID;
BEGIN
    -- Get the interaction and verify ownership
    SELECT * INTO interaction_record
    FROM public.user_interactions
    WHERE id = target_interaction_id 
    AND user_id = target_user_id 
    AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Interaction not found or not active'
        );
    END IF;
    
    -- Insert the response
    INSERT INTO public.interaction_responses (interaction_id, user_id, response)
    VALUES (target_interaction_id, target_user_id, user_response)
    RETURNING id INTO response_id;
    
    -- Mark interaction as responded
    UPDATE public.user_interactions
    SET status = 'responded'
    WHERE id = target_interaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'response_id', response_id,
        'interaction', row_to_json(interaction_record)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;