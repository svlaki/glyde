-- Create rules table for persistent behavioral guidelines
CREATE TABLE public.rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Core fields
    rule_text TEXT NOT NULL,           -- The actual rule instruction
    description TEXT,                  -- Optional explanation

    -- Metadata
    enabled BOOLEAN DEFAULT true,      -- Toggle on/off
    priority INTEGER DEFAULT 5,        -- 1-10 scale, higher = more important
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'agent')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Constraints: prevent duplicate rules for same user
    UNIQUE(user_id, rule_text)
);

-- Enable RLS
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for rules
CREATE POLICY "Users can view their own rules" ON public.rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rules" ON public.rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rules" ON public.rules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rules" ON public.rules
    FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_rules_user_id ON public.rules(user_id);
CREATE INDEX idx_rules_enabled ON public.rules(enabled);
CREATE INDEX idx_rules_user_enabled ON public.rules(user_id, enabled);
CREATE INDEX idx_rules_priority ON public.rules(priority DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on changes
CREATE TRIGGER trigger_rules_updated_at
    BEFORE UPDATE ON public.rules
    FOR EACH ROW
    EXECUTE FUNCTION update_rules_updated_at();

-- Function to get enabled rules for a user (sorted by priority)
CREATE OR REPLACE FUNCTION get_user_enabled_rules(target_user_id UUID)
RETURNS TABLE (
    id UUID,
    rule_text TEXT,
    description TEXT,
    priority INTEGER,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.rule_text,
        r.description,
        r.priority,
        r.source,
        r.created_at
    FROM public.rules r
    WHERE r.user_id = target_user_id
    AND r.enabled = true
    ORDER BY r.priority DESC, r.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
