-- Add timezone column to profile table for proper time handling
-- This migration adds a timezone field to store user's timezone preference

-- Add timezone column to profile table
ALTER TABLE profile 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Add comment to document the timezone column
COMMENT ON COLUMN profile.timezone IS 'User timezone in IANA timezone format (e.g., America/New_York, America/Los_Angeles)';

-- Create index for timezone queries (optional but useful for analytics)
CREATE INDEX IF NOT EXISTS idx_profile_timezone ON profile (timezone);

-- Update existing users to have a default timezone
-- You may want to detect this from user location or ask them to set it
UPDATE profile 
SET timezone = 'America/New_York' 
WHERE timezone IS NULL;

-- Example timezone values for reference:
-- 'America/New_York'    (Eastern Time - EST/EDT)
-- 'America/Chicago'     (Central Time - CST/CDT)  
-- 'America/Denver'      (Mountain Time - MST/MDT)
-- 'America/Los_Angeles' (Pacific Time - PST/PDT)
-- 'UTC'                 (Coordinated Universal Time)
-- 'Europe/London'       (Greenwich Mean Time/British Summer Time)
-- 'Europe/Berlin'       (Central European Time)
-- 'Asia/Tokyo'          (Japan Standard Time)