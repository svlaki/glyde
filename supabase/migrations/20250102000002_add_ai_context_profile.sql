-- Add AI Context Profile column to profile table
-- This stores structured user information that the AI continuously learns and updates

ALTER TABLE public.profile
ADD COLUMN IF NOT EXISTS ai_context_profile JSONB DEFAULT '{
  "version": "1.0",
  "lastUpdated": null,
  "life": {
    "coreValues": [],
    "currentLifePhase": null,
    "majorCommitments": [],
    "lifeGoals": {
      "shortTerm": [],
      "mediumTerm": [],
      "longTerm": []
    }
  },
  "work": {
    "role": null,
    "company": null,
    "workingHours": {
      "start": "09:00",
      "end": "17:00",
      "flexibility": "medium"
    },
    "focusAreas": [],
    "upcomingDeadlines": [],
    "collaborators": []
  },
  "productivity": {
    "peakFocusHours": [],
    "energyPattern": {
      "morning": null,
      "afternoon": null,
      "evening": null
    },
    "optimalSessionLength": null,
    "breakPreferences": {
      "frequency": null,
      "duration": null,
      "activities": []
    },
    "distractionTriggers": [],
    "contextSwitchingCost": null
  },
  "health": {
    "exerciseRoutine": {
      "frequency": null,
      "preferredTimes": [],
      "types": [],
      "duration": null
    },
    "sleepSchedule": {
      "targetBedtime": null,
      "targetWakeTime": null,
      "hoursNeeded": null
    },
    "nutrition": {
      "mealTimes": {
        "breakfast": null,
        "lunch": null,
        "dinner": null
      },
      "dietaryRestrictions": [],
      "hydrationReminders": false
    },
    "mentalHealth": {
      "stressManagement": [],
      "boundaries": []
    }
  },
  "relationships": {
    "importantPeople": [],
    "socialNeeds": {
      "introvertExtrovert": null,
      "rechargeActivities": [],
      "groupSizePreference": null
    }
  },
  "routines": {
    "morning": [],
    "evening": [],
    "weekly": []
  },
  "decisionMaking": {
    "riskTolerance": null,
    "planningStyle": null,
    "prioritizationMethod": null,
    "timeHorizon": null
  },
  "communication": {
    "preferredMeetingLength": null,
    "meetingFrequencyTolerance": {
      "max_per_day": null,
      "max_per_week": null
    },
    "responseExpectations": {
      "email": null,
      "chat": null
    },
    "presentationStyle": null
  },
  "learning": {
    "currentLearningGoals": [],
    "learningStyle": null,
    "skillDevelopmentAreas": [],
    "timeInvestedPerWeek": null
  },
  "agentPreferences": {
    "proactivityLevel": "medium",
    "suggestionFrequency": "moderate",
    "notificationStyle": "batched",
    "tonePreference": "friendly",
    "explanationLevel": "concise",
    "confirmationRequired": ["calendar-changes", "task-creation"]
  },
  "rules": {
    "autoScheduling": {
      "enabled": false,
      "constraints": [],
      "bufferBetweenMeetings": 15
    },
    "taskManagement": {
      "autoDeadlines": false,
      "defaultDuration": 30,
      "urgencyThreshold": 3
    },
    "goalTracking": {
      "checkInFrequency": "weekly",
      "progressNotifications": true
    }
  }
}'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_profile_ai_context_gin
ON public.profile USING GIN (ai_context_profile);

-- Index for specific path queries (frequently accessed fields)
CREATE INDEX IF NOT EXISTS idx_profile_ai_agent_prefs
ON public.profile ((ai_context_profile->'agentPreferences'));

CREATE INDEX IF NOT EXISTS idx_profile_ai_productivity
ON public.profile ((ai_context_profile->'productivity'));

CREATE INDEX IF NOT EXISTS idx_profile_ai_work
ON public.profile ((ai_context_profile->'work'));

-- Add comment explaining the column
COMMENT ON COLUMN public.profile.ai_context_profile IS
'Structured AI learning profile - continuously updated by agent observations and user edits. Contains 11 categories of user context for proactive assistance.';

-- Update updated_at trigger to include ai_context_profile changes
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Update lastUpdated timestamp in ai_context_profile when it changes
  IF NEW.ai_context_profile IS DISTINCT FROM OLD.ai_context_profile THEN
    NEW.ai_context_profile = jsonb_set(
      NEW.ai_context_profile,
      '{lastUpdated}',
      to_jsonb(NOW()::text)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_profile_timestamp ON public.profile;
CREATE TRIGGER trigger_update_profile_timestamp
  BEFORE UPDATE ON public.profile
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();
