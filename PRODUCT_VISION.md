# Glydeeee - Product Vision & Architecture Guide

## Executive Summary

Glydeeee is a **Personal Intelligence Operating System** that combines calendar management, task tracking, goal pursuit, and AI-powered life coaching into a unified proactive assistant. The system learns from user behavior, preferences, and patterns to provide both tactical guidance ("What do I do next?") and strategic direction ("Why am I doing it?").

---

## Core Philosophy

### The Proactive Assistant Paradigm
Unlike reactive tools that wait for commands, Glydeeee **anticipates needs** and **suggests actions** based on:
- User behavior patterns and productivity rhythms
- Calendar gaps and optimization opportunities
- Goal progress and milestone tracking
- Energy levels and context requirements
- Personal values and long-term aspirations

### Key Differentiators
1. **Unified Context**: Events, tasks, and goals are interconnected entities
2. **AI-Native Design**: LLM integration from the ground up, not bolted on
3. **Learning System**: Continuously adapts to user patterns via Zep memory
4. **Proactive Interactions**: Suggests optimizations before being asked
5. **Per-User Isolation**: Complete data separation via user-specific database schemas

---

## Current Architecture Overview

### Database: Per-User Schema Model

Each user gets an **isolated PostgreSQL schema** (`u_{user_id_without_hyphens}`) containing:

#### 1. **Events Table** ✅ FULLY IMPLEMENTED
```sql
u_{user_id}.events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_title TEXT NOT NULL,
  event_starts_at TIMESTAMPTZ NOT NULL,
  event_ends_at TIMESTAMPTZ NOT NULL,
  event_location TEXT,
  event_description TEXT,
  color TEXT DEFAULT '#3b82f6',
  archetype TEXT DEFAULT 'generic',      -- Event categorization
  archetype_data JSONB DEFAULT '{}',     -- Structured metadata per archetype
  embedding VECTOR(1536),                -- For semantic search
  event_created_at TIMESTAMPTZ,
  event_updated_at TIMESTAMPTZ
)
```

**Event Archetypes** (Structured Event Types):
- `workout` - Exercise tracking (exercises, sets, reps)
- `grocery` - Shopping lists (items, quantities, completion status)
- `meeting` - Work meetings (attendees, agenda, meeting links)
- `appointment` - Doctor/service appointments (provider, type, location)
- `travel` - Travel plans (destination, departure time, transport)
- `work_focus` - Deep work blocks (task lists, focus techniques)
- `personal` - General personal events (notes)
- `generic` - Default catch-all type

#### 2. **Tasks Table** ✅ SCHEMA IMPLEMENTED, TOOLS PENDING
```sql
u_{user_id}.tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'personal',
  due_date TIMESTAMPTZ,                  -- ONLY due date, no start time
  priority TEXT DEFAULT 'medium',        -- low, medium, high, urgent
  status TEXT DEFAULT 'pending',         -- pending, in_progress, completed, cancelled
  completed_at TIMESTAMPTZ,
  parent_goal_id UUID,                   -- Links to goals table
  color TEXT,

  -- AI-Enhanced Fields
  energy_required TEXT,                  -- low, medium, high
  estimated_duration INTEGER,            -- minutes
  actual_duration INTEGER,               -- minutes (tracked on completion)
  context_required JSONB DEFAULT '{}',   -- Prerequisites, tools, environment
  completion_notes TEXT,
  recurring_pattern JSONB DEFAULT '{}',  -- Recurring task rules
  task_metadata JSONB DEFAULT '{}',      -- Flexible metadata

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Key Insight**: Tasks are essentially **events with only an end time** (the due date). They represent commitments that must be completed by a deadline but don't have a fixed start time.

#### 3. **Goals Table** ✅ SCHEMA IMPLEMENTED, TOOLS PENDING
```sql
u_{user_id}.goals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'personal',
  target_date TIMESTAMPTZ,
  status TEXT DEFAULT 'active',          -- active, completed, paused, abandoned
  progress INTEGER DEFAULT 0,            -- 0-100 percentage
  milestones JSONB,

  -- Advanced Goal Tracking
  goal_type TEXT DEFAULT 'SMART',        -- SMART, OKR, milestone, habit, project
  parent_goal_id UUID,                   -- Hierarchical goals
  key_results JSONB DEFAULT '[]',        -- OKR key results
  blockers JSONB DEFAULT '[]',           -- Current obstacles
  resources_needed JSONB DEFAULT '[]',   -- What's needed to achieve
  reflection_prompts JSONB DEFAULT '{}', -- AI-generated reflection questions
  priority_score INTEGER DEFAULT 5,      -- 1-10 importance score
  energy_requirement TEXT,               -- low, medium, high
  review_frequency TEXT DEFAULT 'weekly',-- daily, weekly, monthly, quarterly

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### 4. **Goal Check-ins Table** ✅ IMPLEMENTED
```sql
u_{user_id}.goal_check_ins (
  id UUID PRIMARY KEY,
  goal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress_update TEXT,
  mood_rating INTEGER,                   -- 1-5 scale
  confidence_level INTEGER,              -- 1-5 scale
  obstacles_encountered JSONB DEFAULT '[]',
  wins_and_progress JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  reflection_notes TEXT,
  agent_insights JSONB DEFAULT '{}',     -- AI-generated insights
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### User Profile System

#### Current Profile Table (public.profile)
```sql
public.profile (
  id UUID PRIMARY KEY,
  email TEXT,
  timezone TEXT DEFAULT 'America/Chicago',

  -- AI Context Fields
  values JSONB DEFAULT '{}',             -- Core values and beliefs
  preferences JSONB DEFAULT '{}',        -- Work hours, communication style, productivity prefs
  work_patterns JSONB DEFAULT '{}',      -- Peak hours, energy levels, habits
  goals_summary TEXT,                    -- High-level life goals
  personality_traits JSONB DEFAULT '{}', -- Personality insights
  context_data JSONB DEFAULT '{}'        -- Flexible additional context
)
```

**Example Profile Data Structures**:

```json
// preferences
{
  "work_hours": {"start": "09:00", "end": "17:00", "timezone": "America/New_York"},
  "communication": {"style": "direct", "frequency": "moderate"},
  "productivity": {"break_intervals": 90, "deep_work_blocks": 120},
  "notification_settings": {"urgent_only": false, "quiet_hours": {"start": "22:00", "end": "08:00"}}
}

// work_patterns
{
  "peak_hours": [9, 10, 11, 14, 15, 16],
  "energy_levels": {"morning": "high", "afternoon": "medium", "evening": "low"},
  "productivity_metrics": {"focus_duration_avg": 45, "break_duration_avg": 15},
  "meeting_patterns": {"max_per_day": 4, "preferred_duration": 30}
}

// personality_traits
{
  "big_five": {"openness": 0.8, "conscientiousness": 0.9, "extraversion": 0.6},
  "work_style": "analytical",
  "decision_making": "deliberative"
}
```

---

## Proactive Interaction System

### Current Implementation ✅
The system uses a **smart interaction service** that generates contextual questions based on calendar analysis:

```sql
public.user_interactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  type TEXT,                             -- yes_no, multiple_choice, text
  options JSONB DEFAULT '[]',
  event_data JSONB DEFAULT '{}',         -- Suggested event to create
  priority INTEGER DEFAULT 5,
  category TEXT DEFAULT 'general',
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',          -- active, responded, expired, dismissed
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '4 hours')
)
```

### Interaction Categories Currently Supported:
1. **Gap Filling**: "I noticed you have 2 hours free tomorrow at 2pm. Would you like to schedule deep work?"
2. **Conflict Resolution**: "You have overlapping meetings at 3pm. Which should I reschedule?"
3. **Preparation Reminders**: "Your meeting with John is in 30 minutes. Need time to prepare?"
4. **Routine Suggestions**: "You usually go to the gym on Mondays. Schedule it for this week?"

---

## Proposed Enhancement: AI Context Profile System

### The Problem
Currently, the agent has to **infer** user preferences, habits, and goals from conversation history and event patterns. This is:
- **Slow** (requires semantic search every time)
- **Incomplete** (only knows what's been explicitly mentioned)
- **Inefficient** (same questions asked repeatedly)

### The Solution: Structured User Intelligence Profile

Create a **living document** per user that the AI continuously updates with structured information across predefined categories. This acts as a **"user manual"** for the AI assistant.

### Proposed Implementation

#### Option A: JSONB Column in Profile Table (RECOMMENDED)
Add to `public.profile`:
```sql
ALTER TABLE public.profile
ADD COLUMN ai_context_profile JSONB DEFAULT '{}';
```

**Advantages**:
- Single source of truth
- Transactional updates
- Easy to query with PostgreSQL JSONB operators
- Can index specific paths for performance
- Integrated with existing user management

#### Option B: Separate JSON File (NOT RECOMMENDED)
- Requires separate storage system
- Harder to maintain consistency
- More complex deployment

### AI Context Profile Schema

```typescript
interface AIContextProfile {
  // Last updated timestamp
  lastUpdated: string;

  // Version for schema evolution
  version: string;

  // 1. LIFE CONTEXT
  life: {
    coreValues: string[];              // "family first", "continuous learning", "health"
    currentLifePhase: string;          // "early career", "parenting", "retirement planning"
    majorCommitments: string[];        // "full-time job", "part-time MBA", "training for marathon"
    lifeGoals: {
      shortTerm: string[];             // Next 3-6 months
      mediumTerm: string[];            // 6-12 months
      longTerm: string[];              // 1-5 years
    };
  };

  // 2. WORK CONTEXT
  work: {
    role: string;                      // "Senior Software Engineer"
    company: string;
    workingHours: {
      start: string;                   // "09:00"
      end: string;                     // "17:00"
      flexibility: string;             // "high", "medium", "low"
    };
    focusAreas: string[];              // "backend development", "system design"
    upcomingDeadlines: Array<{
      name: string;
      date: string;
      criticality: string;
    }>;
    collaborators: Array<{
      name: string;
      relationship: string;            // "manager", "peer", "report"
      frequency: string;               // "daily", "weekly"
    }>;
  };

  // 3. PRODUCTIVITY PATTERNS
  productivity: {
    peakFocusHours: number[];          // [9, 10, 11, 14, 15]
    energyPattern: {
      morning: string;                 // "high", "medium", "low"
      afternoon: string;
      evening: string;
    };
    optimalSessionLength: number;      // Minutes of focused work
    breakPreferences: {
      frequency: number;               // Minutes between breaks
      duration: number;                // Break length
      activities: string[];            // "walk", "coffee", "stretch"
    };
    distractionTriggers: string[];     // "phone notifications", "open slack"
    contextSwitchingCost: string;      // "high", "medium", "low"
  };

  // 4. HEALTH & WELLNESS
  health: {
    exerciseRoutine: {
      frequency: string;               // "3x per week"
      preferredTimes: string[];        // "morning", "lunch"
      types: string[];                 // "running", "gym", "yoga"
      duration: number;                // Typical session length
    };
    sleepSchedule: {
      targetBedtime: string;           // "22:30"
      targetWakeTime: string;          // "06:30"
      hoursNeeded: number;             // 7-9
    };
    nutrition: {
      mealTimes: {
        breakfast: string;
        lunch: string;
        dinner: string;
      };
      dietaryRestrictions: string[];
      hydrationReminders: boolean;
    };
    mentalHealth: {
      stressManagement: string[];      // "meditation", "journaling"
      boundaries: string[];            // "no work after 6pm", "no meetings before 9am"
    };
  };

  // 5. RELATIONSHIPS & SOCIAL
  relationships: {
    importantPeople: Array<{
      name: string;
      relationship: string;            // "partner", "child", "parent", "friend"
      contactFrequency: string;        // "daily", "weekly"
      preferredActivities: string[];
    }>;
    socialNeeds: {
      introvertExtrovert: string;      // "introvert", "extrovert", "ambivert"
      rechargeActivities: string[];    // "alone time", "social gatherings"
      groupSizePreference: string;     // "1-on-1", "small groups", "large groups"
    };
  };

  // 6. ROUTINES & HABITS
  routines: {
    morning: Array<{
      activity: string;
      duration: number;
      priority: string;                // "must", "should", "nice-to-have"
    }>;
    evening: Array<{
      activity: string;
      duration: number;
      priority: string;
    }>;
    weekly: Array<{
      activity: string;
      dayOfWeek: string;
      time: string;
      flexible: boolean;
    }>;
  };

  // 7. DECISION-MAKING PREFERENCES
  decisionMaking: {
    riskTolerance: string;             // "conservative", "moderate", "aggressive"
    planningStyle: string;             // "spontaneous", "structured", "balanced"
    prioritizationMethod: string;      // "eisenhower", "eat-the-frog", "pomodoro"
    timeHorizon: string;               // "short-term focused", "long-term focused", "balanced"
  };

  // 8. COMMUNICATION STYLE
  communication: {
    preferredMeetingLength: number;    // Minutes
    meetingFrequencyTolerance: {
      max_per_day: number;
      max_per_week: number;
    };
    responseExpectations: {
      email: string;                   // "24 hours", "same day"
      chat: string;                    // "immediate", "within hour"
    };
    presentationStyle: string;         // "detailed", "high-level", "visual"
  };

  // 9. LEARNING & GROWTH
  learning: {
    currentLearningGoals: string[];
    learningStyle: string;             // "visual", "auditory", "kinesthetic", "reading"
    skillDevelopmentAreas: string[];
    timeInvestedPerWeek: number;
  };

  // 10. AGENT INTERACTION PREFERENCES
  agentPreferences: {
    proactivityLevel: string;          // "high", "medium", "low"
    suggestionFrequency: string;       // "frequent", "moderate", "minimal"
    notificationStyle: string;         // "immediate", "batched", "daily-digest"
    tonePreference: string;            // "formal", "casual", "friendly"
    explanationLevel: string;          // "concise", "detailed", "context-dependent"
    confirmationRequired: string[];    // ["calendar-changes", "task-creation", "goal-updates"]
  };

  // 11. CONTEXT-SPECIFIC RULES
  rules: {
    autoScheduling: {
      enabled: boolean;
      constraints: string[];           // "no meetings before 9am", "block fridays for deep work"
      bufferBetweenMeetings: number;   // Minutes
    };
    taskManagement: {
      autoDeadlines: boolean;
      defaultDuration: number;
      urgencyThreshold: number;        // Days before due date
    };
    goalTracking: {
      checkInFrequency: string;        // "daily", "weekly"
      progressNotifications: boolean;
    };
  };
}
```

### How The AI Uses This Profile

#### 1. **Proactive Interaction Generation**
The `SmartInteractionService` can consult the profile to generate **highly personalized** suggestions:

```typescript
// Instead of generic "Would you like to schedule exercise?"
// The AI knows:
- User prefers morning workouts
- Typical session is 45 minutes
- Usually does gym on Mon/Wed/Fri
- Needs high energy for best performance

// Generates: "I see you have a free hour tomorrow (Wednesday) at 7am,
// which aligns with your usual gym schedule. Your energy is typically
// high in the morning. Schedule your workout?"
```

#### 2. **Smart Scheduling**
```typescript
// Profile shows:
- No meetings before 9am (boundary)
- Peak focus hours: 9-11am (protect for deep work)
- Max 4 meetings per day (communication preference)
- Buffer 15 minutes between meetings (auto-scheduling rule)

// Agent automatically:
- Blocks 9-11am for deep work tasks
- Declines meetings outside hours
- Suggests rescheduling when daily limit reached
```

#### 3. **Goal-Aligned Suggestions**
```typescript
// Profile shows long-term goal: "Get promoted to Staff Engineer"
// Profile shows learning goal: "Master system design"

// When finding calendar gaps, AI prioritizes:
- Study time for system design (learning)
- Code review opportunities (visibility)
- Architecture meetings (involvement)
```

#### 4. **Energy-Aware Task Allocation**
```typescript
// Profile shows energy pattern:
- Morning: high (9am-12pm)
- Afternoon: medium (1pm-4pm)
- Evening: low (after 5pm)

// Task requires: high energy, 90 minutes focus

// AI suggests: Tomorrow 9am-10:30am (peak energy window)
// NOT: Tomorrow 3pm (medium energy, user will struggle)
```

### Profile Update Mechanisms

#### Automatic Learning (Passive Updates)
```typescript
// Agent observes patterns and updates profile automatically:
- User consistently exercises at 7am → Update exerciseRoutine.preferredTimes
- User completes deep work best 9-11am → Update peakFocusHours
- User dismisses all evening meeting suggestions → Update boundaries
- User always takes 15-min coffee break at 3pm → Update breakPreferences
```

#### Conversational Updates (Active)
```typescript
// During natural conversation, agent extracts and updates:
User: "I'm training for a marathon in June"
Agent: → Updates life.majorCommitments, health.exerciseRoutine, life.lifeGoals
      → Generates interaction: "Should I protect your long run time on Sundays?"

User: "I'm feeling burned out with 6 meetings per day"
Agent: → Updates communication.meetingFrequencyTolerance.max_per_day = 4
      → Starts declining/rescheduling to enforce
```

#### Periodic Check-ins (Explicit)
```typescript
// Weekly profile review questions:
"Your profile shows you work best in mornings. Is this still accurate?"
"I've noticed you're completing tasks faster. Should I adjust estimates?"
"You haven't had a goal check-in this week. Want to review progress?"
```

---

## Interaction Strategy Matrix

### When to Generate Proactive Interactions

| Trigger | Profile Field Consulted | Interaction Type | Example |
|---------|-------------------------|------------------|---------|
| Calendar gap detected | `productivity.peakFocusHours` | Suggestion | "Free hour at your peak focus time. Schedule deep work?" |
| Approaching deadline | `work.upcomingDeadlines` | Reminder | "Project due in 2 days. Need more time blocked?" |
| Missing routine | `routines.weekly` | Prompt | "You usually run on Wednesdays. Schedule it?" |
| Energy mismatch | `productivity.energyPattern` | Optimization | "High-energy task scheduled for low-energy time. Reschedule?" |
| Boundary violation | `health.mentalHealth.boundaries` | Alert | "Meeting scheduled at 7pm violates your no-work-after-6 rule" |
| Goal neglect | `learning.currentLearningGoals` | Check-in | "No progress on system design learning this week. Block study time?" |
| Over-scheduling | `communication.meetingFrequencyTolerance` | Warning | "You've hit your daily meeting limit. Decline new requests?" |
| Health routine | `health.exerciseRoutine` | Reminder | "Gym day! You have 45 min free at 7am." |
| Relationship maintenance | `relationships.importantPeople` | Suggestion | "Haven't contacted Mom this week (usual: weekly). Schedule call?" |
| Rest needed | `health.sleepSchedule` | Boundary | "Bedtime in 30 min. Wrap up current task?" |

---

## Implementation Roadmap

### Phase 1: Profile Infrastructure (Week 1)
- [ ] Add `ai_context_profile` JSONB column to profile table
- [ ] Create TypeScript interface for AIContextProfile
- [ ] Build profile initialization function (creates default structure)
- [ ] Implement profile update service with validation

### Phase 2: Profile Learning (Week 2-3)
- [ ] Create profile update tools for agents
- [ ] Implement passive observation system (learn from patterns)
- [ ] Add conversational extraction (update from user messages)
- [ ] Build profile query helpers for agents

### Phase 3: Enhanced Interactions (Week 4)
- [ ] Refactor SmartInteractionService to use profile
- [ ] Implement interaction strategy matrix
- [ ] Add profile-based interaction prioritization
- [ ] Create interaction templates per category

### Phase 4: Task & Goal Tools (Week 5-6)
- [ ] Build task CRUD tools for agents
- [ ] Implement goal management tools
- [ ] Create goal check-in workflow
- [ ] Add task-goal linking logic

### Phase 5: Smart Scheduling (Week 7-8)
- [ ] Implement energy-aware task allocation
- [ ] Build automatic calendar optimization
- [ ] Add conflict detection and resolution
- [ ] Create routine protection logic

---

## Success Metrics

### User Engagement
- **Interaction Response Rate**: % of proactive suggestions accepted
- **Profile Completeness**: % of profile fields populated
- **Agent Accuracy**: How often suggestions align with user preferences
- **Time Saved**: Reduction in manual scheduling/planning time

### System Intelligence
- **Learning Speed**: Time to reach 80% profile completeness
- **Prediction Accuracy**: % of suggestions that match user's eventual action
- **Proactivity Score**: Ratio of proactive vs. reactive interactions
- **Context Retention**: % of preferences remembered across sessions

### Behavioral Outcomes
- **Goal Progress**: % of goals with regular check-ins
- **Routine Adherence**: % of planned routines actually completed
- **Energy Alignment**: % of tasks scheduled during optimal energy windows
- **Boundary Respect**: % of scheduling decisions that honor user boundaries

---

## Current Status Summary

### ✅ Fully Implemented
- Per-user database schemas
- Events with archetypes (7 types)
- User authentication and RLS
- Zep Cloud memory integration
- LangChain/LangGraph agent system
- Streaming chat interface
- Basic smart interactions (gap finding)
- User profile with JSONB fields

### 🔄 Schema Ready, Tools Pending
- Tasks table (comprehensive schema exists)
- Goals table (comprehensive schema exists)
- Goal check-ins table (comprehensive schema exists)

### 📋 Design Phase
- AI Context Profile structure
- Profile learning mechanisms
- Enhanced interaction strategies
- Energy-aware scheduling
- Goal-task-event linking

### 🚀 Future Vision
- Multi-agent orchestration (Task, Goal, Pattern agents)
- Mobile app (React Native)
- Voice interface
- Offline PWA support
- Team/family sharing features
- Integration marketplace (Google Cal, Notion, etc.)

---

## For AI Agents Working On This Project

### Key Principles to Follow

1. **Always Consult User Profile First**: Before suggesting anything, check if relevant profile data exists
2. **Learn Continuously**: Every user interaction is a chance to update the profile
3. **Respect Boundaries**: Profile rules override all other logic
4. **Explain Reasoning**: When making suggestions, reference profile fields used
5. **Graceful Degradation**: If profile data is missing, ask or use sensible defaults
6. **Maintain Consistency**: Keep events, tasks, and goals synchronized
7. **Energy-Aware**: Always consider user's energy patterns when scheduling
8. **Goal-Aligned**: Prioritize activities that advance user's stated goals

### When Building New Features

**Ask yourself:**
- Does this feature need profile data? Which fields?
- How will this feature learn and update the profile?
- What interactions should this trigger?
- How does this relate to existing events/tasks/goals?
- What boundaries or rules should this respect?
- Can this be automated or does it need user confirmation?

### Common Pitfalls to Avoid

❌ **Don't** make assumptions without checking profile
✅ **Do** consult profile fields or ask user

❌ **Don't** spam users with low-value interactions
✅ **Do** prioritize based on profile.agentPreferences.suggestionFrequency

❌ **Don't** treat events/tasks/goals as separate systems
✅ **Do** maintain relationships and context between them

❌ **Don't** ignore energy patterns when scheduling
✅ **Do** match task difficulty to user's energy availability

❌ **Don't** update profile silently without confidence
✅ **Do** ask for confirmation on uncertain updates

---

## End Goal: The Ideal User Experience

> "I wake up and check Glydeeee. It already blocked my morning deep work time, protected my gym slot, and rescheduled a low-priority meeting that conflicted with my daughter's school play. It reminds me I'm behind on my system design learning goal and suggests a 30-minute study session during my afternoon slump. At lunch, it asks if I want to schedule a call with my mentor since I haven't connected in 3 weeks. By EOD, it's updated my profile based on today's patterns and prepared tomorrow's optimized schedule. I trust it completely because it knows me better than I know myself."

This is Glydeeee.

---

**Document Version**: 1.0
**Last Updated**: 2025-01-02
**Maintained By**: Development Team
**Next Review**: After Phase 1 Completion
