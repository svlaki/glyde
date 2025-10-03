// AI Context Profile - Structured user intelligence for proactive assistance
// This interface matches the database schema in 20250102000002_add_ai_context_profile.sql

export interface AIContextProfile {
  version: string;
  lastUpdated: string | null;

  life: LifeContext;
  work: WorkContext;
  productivity: ProductivityContext;
  health: HealthContext;
  relationships: RelationshipsContext;
  routines: RoutinesContext;
  decisionMaking: DecisionMakingContext;
  communication: CommunicationContext;
  learning: LearningContext;
  agentPreferences: AgentPreferences;
  rules: ContextRules;
}

export interface LifeContext {
  coreValues: string[];
  currentLifePhase: string | null;
  majorCommitments: string[];
  lifeGoals: {
    shortTerm: string[];    // Next 3-6 months
    mediumTerm: string[];   // 6-12 months
    longTerm: string[];     // 1-5 years
  };
}

export interface WorkContext {
  role: string | null;
  company: string | null;
  workingHours: {
    start: string;
    end: string;
    flexibility: 'high' | 'medium' | 'low';
  };
  focusAreas: string[];
  upcomingDeadlines: Array<{
    name: string;
    date: string;
    criticality: 'low' | 'medium' | 'high' | 'critical';
  }>;
  collaborators: Array<{
    name: string;
    relationship: 'manager' | 'peer' | 'report' | 'client';
    frequency: 'daily' | 'weekly' | 'monthly';
  }>;
}

export interface ProductivityContext {
  peakFocusHours: number[];  // Array of hours 0-23
  energyPattern: {
    morning: 'high' | 'medium' | 'low' | null;
    afternoon: 'high' | 'medium' | 'low' | null;
    evening: 'high' | 'medium' | 'low' | null;
  };
  optimalSessionLength: number | null;  // Minutes
  breakPreferences: {
    frequency: number | null;  // Minutes between breaks
    duration: number | null;   // Break length in minutes
    activities: string[];
  };
  distractionTriggers: string[];
  contextSwitchingCost: 'high' | 'medium' | 'low' | null;
}

export interface HealthContext {
  exerciseRoutine: {
    frequency: string | null;  // "3x per week", "daily", etc.
    preferredTimes: string[];  // "morning", "lunch", "evening"
    types: string[];           // "running", "gym", "yoga"
    duration: number | null;   // Typical session length in minutes
  };
  sleepSchedule: {
    targetBedtime: string | null;     // "22:30"
    targetWakeTime: string | null;    // "06:30"
    hoursNeeded: number | null;       // 7-9
  };
  nutrition: {
    mealTimes: {
      breakfast: string | null;
      lunch: string | null;
      dinner: string | null;
    };
    dietaryRestrictions: string[];
    hydrationReminders: boolean;
  };
  mentalHealth: {
    stressManagement: string[];  // "meditation", "journaling"
    boundaries: string[];        // "no work after 6pm"
  };
}

export interface RelationshipsContext {
  importantPeople: Array<{
    name: string;
    relationship: 'partner' | 'child' | 'parent' | 'friend' | 'mentor';
    contactFrequency: 'daily' | 'weekly' | 'monthly';
    preferredActivities: string[];
  }>;
  socialNeeds: {
    introvertExtrovert: 'introvert' | 'extrovert' | 'ambivert' | null;
    rechargeActivities: string[];
    groupSizePreference: '1-on-1' | 'small-groups' | 'large-groups' | null;
  };
}

export interface RoutineActivity {
  activity: string;
  duration: number;
  priority: 'must' | 'should' | 'nice-to-have';
}

export interface WeeklyRoutine {
  activity: string;
  dayOfWeek: string;
  time: string;
  flexible: boolean;
}

export interface RoutinesContext {
  morning: RoutineActivity[];
  evening: RoutineActivity[];
  weekly: WeeklyRoutine[];
}

export interface DecisionMakingContext {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | null;
  planningStyle: 'spontaneous' | 'structured' | 'balanced' | null;
  prioritizationMethod: 'eisenhower' | 'eat-the-frog' | 'pomodoro' | 'time-blocking' | null;
  timeHorizon: 'short-term' | 'long-term' | 'balanced' | null;
}

export interface CommunicationContext {
  preferredMeetingLength: number | null;  // Minutes
  meetingFrequencyTolerance: {
    max_per_day: number | null;
    max_per_week: number | null;
  };
  responseExpectations: {
    email: '24-hours' | 'same-day' | 'immediate' | null;
    chat: 'immediate' | 'within-hour' | 'same-day' | null;
  };
  presentationStyle: 'detailed' | 'high-level' | 'visual' | null;
}

export interface LearningContext {
  currentLearningGoals: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | null;
  skillDevelopmentAreas: string[];
  timeInvestedPerWeek: number | null;  // Hours
}

export interface AgentPreferences {
  proactivityLevel: 'high' | 'medium' | 'low';
  suggestionFrequency: 'frequent' | 'moderate' | 'minimal';
  notificationStyle: 'immediate' | 'batched' | 'daily-digest';
  tonePreference: 'formal' | 'casual' | 'friendly';
  explanationLevel: 'concise' | 'detailed' | 'context-dependent';
  confirmationRequired: string[];  // ["calendar-changes", "task-creation", etc.]
}

export interface ContextRules {
  autoScheduling: {
    enabled: boolean;
    constraints: string[];  // "no meetings before 9am", "block fridays for deep work"
    bufferBetweenMeetings: number;  // Minutes
  };
  taskManagement: {
    autoDeadlines: boolean;
    defaultDuration: number;  // Minutes
    urgencyThreshold: number;  // Days before due date
  };
  goalTracking: {
    checkInFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    progressNotifications: boolean;
  };
}

// Helper types for profile updates
export type ProfileSection = keyof Omit<AIContextProfile, 'version' | 'lastUpdated'>;

export interface ProfileUpdateMetadata {
  source: 'user' | 'agent';
  confidence: number;  // 0-1
  timestamp: string;
  reason?: string;
}

export interface ProfileFieldUpdate {
  path: string;  // JSON path like "productivity.peakFocusHours"
  value: any;
  metadata: ProfileUpdateMetadata;
}
