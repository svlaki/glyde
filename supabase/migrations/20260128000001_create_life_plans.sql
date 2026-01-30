-- Create life_plans table for storing user's semantic life plan
CREATE TABLE IF NOT EXISTS public.life_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'My Life Plan',
  content TEXT,                    -- Semantic plan text (markdown)
  horizon_start DATE,              -- Plan start date
  horizon_end DATE,                -- Plan end date
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index to ensure only one active plan per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_life_plans_user_active
ON public.life_plans(user_id)
WHERE status = 'active';

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_life_plans_user_id ON public.life_plans(user_id);

-- Enable RLS
ALTER TABLE public.life_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own plans"
ON public.life_plans
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plans"
ON public.life_plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
ON public.life_plans
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans"
ON public.life_plans
FOR DELETE
USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.life_plans TO authenticated;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_life_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_life_plan_timestamp
  BEFORE UPDATE ON public.life_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_life_plan_timestamp();

-- Add comment
COMMENT ON TABLE public.life_plans IS
'Stores user life plans with semantic content text. Each user can have one active plan at a time.';
