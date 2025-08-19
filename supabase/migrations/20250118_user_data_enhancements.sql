-- Migration: Enhanced User Data Collection and Intelligence
-- Description: Adds comprehensive tables for user preferences, patterns, goals, insights, and analytics
-- Date: 2025-01-18

-- Create user_preferences table for storing user settings and preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value JSONB,
    category TEXT, -- 'calendar', 'productivity', 'notification', 'ai', etc.
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, preference_key)
);

-- Create user_patterns table for storing detected behavioral patterns
CREATE TABLE IF NOT EXISTS public.user_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_type TEXT NOT NULL, -- 'scheduling', 'productivity', 'meeting', 'break', etc.
    pattern_data JSONB NOT NULL, -- Flexible JSON structure for different pattern types
    confidence_score FLOAT DEFAULT 0.0, -- How confident we are in this pattern (0-1)
    first_detected TIMESTAMPTZ DEFAULT now(),
    last_updated TIMESTAMPTZ DEFAULT now(),
    occurrence_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true
);

-- Create user_goals table for tracking user goals and objectives
CREATE TABLE IF NOT EXISTS public.user_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'health', 'career', 'personal', 'learning', etc.
    target_date DATE,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused', 'abandoned'
    progress_percentage INTEGER DEFAULT 0,
    milestones JSONB, -- Array of milestone objects
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_insights table for storing AI-generated insights
CREATE TABLE IF NOT EXISTS public.user_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL, -- 'productivity', 'health', 'balance', 'suggestion', etc.
    insight_content TEXT NOT NULL,
    data_source TEXT, -- 'calendar_analysis', 'pattern_detection', 'goal_tracking', etc.
    relevance_score FLOAT DEFAULT 0.5, -- How relevant this insight is (0-1)
    was_helpful BOOLEAN, -- User feedback on the insight
    action_taken BOOLEAN DEFAULT false,
    generated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ, -- When this insight is no longer relevant
    metadata JSONB -- Additional context data
);

-- Create user_interactions table for tracking all user interactions
CREATE TABLE IF NOT EXISTS public.user_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL, -- 'chat', 'calendar_action', 'goal_update', 'preference_change', etc.
    action TEXT NOT NULL, -- Specific action taken
    context JSONB, -- Context data for the interaction
    result TEXT, -- Outcome of the interaction
    timestamp TIMESTAMPTZ DEFAULT now(),
    session_id TEXT,
    metadata JSONB
);

-- Create event_analytics table for aggregated event data
CREATE TABLE IF NOT EXISTS public.event_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_events INTEGER DEFAULT 0,
    total_meeting_time INTERVAL,
    total_focus_time INTERVAL,
    total_break_time INTERVAL,
    event_categories JSONB, -- Count by category
    peak_hours JSONB, -- Most busy hours of the day
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Create user_context table for maintaining conversation context
CREATE TABLE IF NOT EXISTS public.user_context (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    context_key TEXT NOT NULL,
    context_value JSONB NOT NULL,
    context_type TEXT, -- 'preference', 'routine', 'contact', 'project', etc.
    last_mentioned TIMESTAMPTZ DEFAULT now(),
    mention_count INTEGER DEFAULT 1,
    importance_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, context_key)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON public.user_preferences(category);
CREATE INDEX IF NOT EXISTS idx_user_patterns_user_id ON public.user_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON public.user_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON public.user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON public.user_goals(status);
CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON public.user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_type ON public.user_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON public.user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON public.user_interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_analytics_user_date ON public.event_analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_context_user_id ON public.user_context(user_id);

-- Enable RLS on all new tables
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_preferences
CREATE POLICY "Users can view their own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own preferences" ON public.user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for user_patterns
CREATE POLICY "Users can view their own patterns" ON public.user_patterns
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own patterns" ON public.user_patterns
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for user_goals
CREATE POLICY "Users can view their own goals" ON public.user_goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own goals" ON public.user_goals
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for user_insights
CREATE POLICY "Users can view their own insights" ON public.user_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own insights" ON public.user_insights
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for user_interactions
CREATE POLICY "Users can view their own interactions" ON public.user_interactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own interactions" ON public.user_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for event_analytics
CREATE POLICY "Users can view their own analytics" ON public.event_analytics
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own analytics" ON public.event_analytics
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for user_context
CREATE POLICY "Users can view their own context" ON public.user_context
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own context" ON public.user_context
    FOR ALL USING (auth.uid() = user_id);

-- Create functions for pattern detection and analytics

-- Function to analyze daily event patterns
CREATE OR REPLACE FUNCTION analyze_daily_patterns(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_meeting_time INTERVAL;
    v_focus_time INTERVAL;
    v_break_time INTERVAL;
    v_total_events INTEGER;
    v_categories JSONB;
    v_peak_hours JSONB;
BEGIN
    -- Calculate total events
    SELECT COUNT(*) INTO v_total_events
    FROM public.events
    WHERE user_id = p_user_id
    AND DATE(start_time) = p_date;

    -- Calculate meeting time
    SELECT COALESCE(SUM(end_time - start_time), INTERVAL '0') INTO v_meeting_time
    FROM public.events
    WHERE user_id = p_user_id
    AND DATE(start_time) = p_date
    AND (LOWER(title) LIKE '%meeting%' OR LOWER(title) LIKE '%call%' OR LOWER(title) LIKE '%sync%');

    -- Calculate focus time
    SELECT COALESCE(SUM(end_time - start_time), INTERVAL '0') INTO v_focus_time
    FROM public.events
    WHERE user_id = p_user_id
    AND DATE(start_time) = p_date
    AND (LOWER(title) LIKE '%focus%' OR LOWER(title) LIKE '%deep work%' OR LOWER(title) LIKE '%coding%');

    -- Calculate break time
    SELECT COALESCE(SUM(end_time - start_time), INTERVAL '0') INTO v_break_time
    FROM public.events
    WHERE user_id = p_user_id
    AND DATE(start_time) = p_date
    AND (LOWER(title) LIKE '%break%' OR LOWER(title) LIKE '%lunch%' OR LOWER(title) LIKE '%rest%');

    -- Calculate categories
    SELECT jsonb_object_agg(category, count) INTO v_categories
    FROM (
        SELECT 
            CASE
                WHEN LOWER(title) LIKE '%meeting%' OR LOWER(title) LIKE '%call%' THEN 'meeting'
                WHEN LOWER(title) LIKE '%lunch%' OR LOWER(title) LIKE '%dinner%' THEN 'personal'
                WHEN LOWER(title) LIKE '%focus%' OR LOWER(title) LIKE '%work%' THEN 'work'
                ELSE 'other'
            END as category,
            COUNT(*) as count
        FROM public.events
        WHERE user_id = p_user_id
        AND DATE(start_time) = p_date
        GROUP BY category
    ) cat_counts;

    -- Calculate peak hours
    SELECT jsonb_agg(jsonb_build_object('hour', hour, 'count', count)) INTO v_peak_hours
    FROM (
        SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as count
        FROM public.events
        WHERE user_id = p_user_id
        AND DATE(start_time) = p_date
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 3
    ) peak;

    -- Insert or update analytics
    INSERT INTO public.event_analytics (
        user_id, date, total_events, total_meeting_time, 
        total_focus_time, total_break_time, event_categories, peak_hours
    ) VALUES (
        p_user_id, p_date, v_total_events, v_meeting_time,
        v_focus_time, v_break_time, v_categories, v_peak_hours
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        total_events = EXCLUDED.total_events,
        total_meeting_time = EXCLUDED.total_meeting_time,
        total_focus_time = EXCLUDED.total_focus_time,
        total_break_time = EXCLUDED.total_break_time,
        event_categories = EXCLUDED.event_categories,
        peak_hours = EXCLUDED.peak_hours,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to detect user patterns
CREATE OR REPLACE FUNCTION detect_user_patterns(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_pattern JSONB;
BEGIN
    -- Detect meeting patterns
    WITH meeting_times AS (
        SELECT 
            EXTRACT(DOW FROM start_time) as day_of_week,
            EXTRACT(HOUR FROM start_time) as hour,
            COUNT(*) as occurrences
        FROM public.events
        WHERE user_id = p_user_id
        AND (LOWER(title) LIKE '%meeting%' OR LOWER(title) LIKE '%call%')
        AND start_time > now() - INTERVAL '30 days'
        GROUP BY day_of_week, hour
        HAVING COUNT(*) > 2
    )
    SELECT jsonb_build_object(
        'preferred_meeting_times', jsonb_agg(
            jsonb_build_object('day', day_of_week, 'hour', hour, 'frequency', occurrences)
        )
    ) INTO v_pattern
    FROM meeting_times;

    IF v_pattern IS NOT NULL THEN
        INSERT INTO public.user_patterns (user_id, pattern_type, pattern_data, confidence_score)
        VALUES (p_user_id, 'meeting_preference', v_pattern, 0.7)
        ON CONFLICT (user_id, pattern_type) DO UPDATE SET
            pattern_data = EXCLUDED.pattern_data,
            confidence_score = CASE 
                WHEN user_patterns.occurrence_count > 5 THEN 0.9
                ELSE 0.7
            END,
            occurrence_count = user_patterns.occurrence_count + 1,
            last_updated = now();
    END IF;

    -- Detect productivity patterns
    WITH productivity_hours AS (
        SELECT 
            EXTRACT(HOUR FROM start_time) as hour,
            AVG(EXTRACT(EPOCH FROM (end_time - start_time))/3600) as avg_duration,
            COUNT(*) as event_count
        FROM public.events
        WHERE user_id = p_user_id
        AND start_time > now() - INTERVAL '30 days'
        GROUP BY hour
        ORDER BY event_count DESC
        LIMIT 5
    )
    SELECT jsonb_build_object(
        'peak_hours', jsonb_agg(
            jsonb_build_object('hour', hour, 'avg_duration_hours', avg_duration, 'frequency', event_count)
        )
    ) INTO v_pattern
    FROM productivity_hours;

    IF v_pattern IS NOT NULL THEN
        INSERT INTO public.user_patterns (user_id, pattern_type, pattern_data, confidence_score)
        VALUES (p_user_id, 'productivity_hours', v_pattern, 0.6)
        ON CONFLICT (user_id, pattern_type) DO UPDATE SET
            pattern_data = EXCLUDED.pattern_data,
            confidence_score = CASE 
                WHEN user_patterns.occurrence_count > 10 THEN 0.85
                ELSE 0.6
            END,
            occurrence_count = user_patterns.occurrence_count + 1,
            last_updated = now();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track user interactions
CREATE OR REPLACE FUNCTION track_user_interaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Track event creation/modification
    IF TG_TABLE_NAME = 'events' THEN
        INSERT INTO public.user_interactions (
            user_id, 
            interaction_type, 
            action,
            context,
            result
        ) VALUES (
            NEW.user_id,
            'calendar_action',
            TG_OP,
            jsonb_build_object('event_id', NEW.id, 'title', NEW.title),
            'success'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tracking event interactions
CREATE TRIGGER track_event_interactions
AFTER INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION track_user_interaction();

-- Sample data for default preferences
INSERT INTO public.user_preferences (user_id, preference_key, preference_value, category)
SELECT 
    id,
    'default_event_duration',
    '60',
    'calendar'
FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.user_preferences (user_id, preference_key, preference_value, category)
SELECT 
    id,
    'working_hours',
    '{"start": "09:00", "end": "17:00"}',
    'productivity'
FROM auth.users
ON CONFLICT DO NOTHING;