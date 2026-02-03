-- Add force_reauth column to profile table
-- When true, frontend will clear localStorage and redirect user to onboarding

ALTER TABLE public.profile
ADD COLUMN IF NOT EXISTS force_reauth BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.profile.force_reauth IS 'When true, frontend will clear localStorage onboardingData and redirect to /onboarding';
