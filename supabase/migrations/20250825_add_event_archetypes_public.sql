-- Add archetype and archetype_data columns to the public events table (replacing category system)
ALTER TABLE public.events 
DROP COLUMN IF EXISTS category,
ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT 'generic',
ADD COLUMN IF NOT EXISTS archetype_data JSONB DEFAULT '{}';

-- Create event archetypes lookup table
CREATE TABLE IF NOT EXISTS public.event_archetypes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    default_color TEXT NOT NULL,
    icon TEXT,
    schema JSONB NOT NULL, -- JSON schema for archetype_data validation
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Insert default archetypes
INSERT INTO public.event_archetypes (id, name, description, default_color, icon, schema) VALUES
('generic', 'Generic', 'Default event type', '#6B7280', NULL, '{}'),
('workout', 'Workout', 'Exercise and fitness activities', '#EF4444', NULL, '{
    "type": "object",
    "properties": {
        "exercises": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "sets": {"type": "number"},
                    "reps": {"type": "number"}
                }
            }
        }
    }
}'),
('grocery', 'Grocery Run', 'Shopping and errands', '#10B981', NULL, '{
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item": {"type": "string"},
                    "quantity": {"type": "string"},
                    "completed": {"type": "boolean"}
                }
            }
        }
    }
}'),
('meeting', 'Meeting', 'Professional meetings and calls', '#3B82F6', NULL, '{
    "type": "object",
    "properties": {
        "attendees": {
            "type": "array",
            "items": {"type": "string"}
        },
        "agenda": {"type": "string"},
        "meeting_link": {"type": "string"}
    }
}'),
('appointment', 'Appointment', 'Medical, professional appointments', '#059669', NULL, '{
    "type": "object",
    "properties": {
        "provider": {"type": "string"},
        "type": {"type": "string"},
        "location": {"type": "string"}
    }
}'),
('travel', 'Travel', 'Transportation and travel plans', '#8B5CF6', NULL, '{
    "type": "object",
    "properties": {
        "destination": {"type": "string"},
        "departure_time": {"type": "string"},
        "transport": {"type": "string"}
    }
}'),
('personal', 'Personal', 'Personal activities and self-care', '#F472B6', NULL, '{
    "type": "object",
    "properties": {
        "notes": {"type": "string"}
    }
}'),
('work_focus', 'Work Focus', 'Deep work and focused tasks', '#F59E0B', NULL, '{
    "type": "object",
    "properties": {
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task": {"type": "string"},
                    "completed": {"type": "boolean"}
                }
            }
        }
    }
}') ON CONFLICT (id) DO NOTHING;

-- Create function to suggest archetype based on event title/description
CREATE OR REPLACE FUNCTION public.suggest_event_archetype(
    event_title TEXT,
    event_description TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    suggested_archetype TEXT := 'generic';
    combined_text TEXT;
BEGIN
    combined_text := LOWER(COALESCE(event_title, '') || ' ' || COALESCE(event_description, ''));
    
    -- Workout patterns
    IF combined_text ~ 'workout|exercise|gym|fitness|training|strength|cardio|yoga|pilates|run|running|swim|cycling|bike|lifting|weights' THEN
        suggested_archetype := 'workout';
    -- Grocery patterns
    ELSIF combined_text ~ 'grocery|shopping|store|market|buy|purchase|costco|target|walmart|trader|whole foods|supplies' THEN
        suggested_archetype := 'grocery';
    -- Meeting patterns
    ELSIF combined_text ~ 'meeting|call|sync|standup|review|interview|conference|presentation|demo|client|team' THEN
        suggested_archetype := 'meeting';
    -- Appointment patterns
    ELSIF combined_text ~ 'appointment|doctor|dentist|medical|checkup|therapy|consultation|visit|clinic|hospital' THEN
        suggested_archetype := 'appointment';
    -- Travel patterns
    ELSIF combined_text ~ 'flight|travel|trip|vacation|airport|train|bus|hotel|booking|departure|arrival' THEN
        suggested_archetype := 'travel';
    -- Work focus patterns
    ELSIF combined_text ~ 'focus|deep work|coding|development|writing|design|analysis|research|project|deadline' THEN
        suggested_archetype := 'work_focus';
    -- Personal patterns
    ELSIF combined_text ~ 'personal|self-care|meditation|family|friend|social|hobby|relaxation|mindfulness' THEN
        suggested_archetype := 'personal';
    END IF;
    
    RETURN suggested_archetype;
END;
$$;

-- Update existing events to have suggested archetypes
UPDATE public.events 
SET archetype = public.suggest_event_archetype(title, description)
WHERE archetype IS NULL OR archetype = 'generic';

-- Create index for better archetype queries
CREATE INDEX IF NOT EXISTS idx_events_archetype ON public.events(archetype);

-- Function to get archetype color for an event
CREATE OR REPLACE FUNCTION public.get_event_archetype_color(archetype_name TEXT, archetype_data JSONB DEFAULT '{}')
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    archetype_color TEXT;
BEGIN
    -- Get color from archetype_data if specified (user override)
    IF archetype_data ? 'color' THEN
        RETURN archetype_data->>'color';
    END IF;
    
    -- Otherwise get default color from archetype definition
    SELECT default_color INTO archetype_color
    FROM public.event_archetypes
    WHERE id = archetype_name;
    
    RETURN COALESCE(archetype_color, '#6B7280'); -- Default gray if archetype not found
END;
$$;