/**
 * Zep v3 Custom Ontology Definition
 *
 * Defines custom entity and edge types for Glydeee's dual-graph architecture:
 * - User Graphs: Personal behavioral patterns, preferences, and history
 * - Central Graph: Cross-user insights and community patterns
 *
 * Max: 10 custom entity types, 10 custom edge types per project
 */

import { entityFields, EntityType, EdgeType } from '@getzep/zep-cloud';

// ============================================================================
// TYPESCRIPT INTERFACES (for type checking)
// ============================================================================

/**
 * TypeScript interface for CalendarEvent data
 */
export interface ICalendarEventEntity {
  eventId?: string;
  title?: string;
  aspect?: string;
  duration_minutes?: number;
  energy_level?: string;
  location?: string;
  attendee_count?: number;
}

/**
 * TypeScript interface for Task data
 */
export interface ITaskEntity {
  taskId?: string;
  title?: string;
  priority?: string;
  aspect?: string;
  estimated_duration?: number;
  actual_duration?: number;
  satisfaction_rating?: number;
  energy_required?: string;
}

/**
 * TypeScript interface for Goal data
 */
export interface IGoalEntity {
  goalId?: string;
  title?: string;
  goal_type?: string;
  status?: string;
  progress_percentage?: number;
  deadline?: string;
  time_invested_minutes?: number;
}

/**
 * TypeScript interface for Pattern data
 */
export interface IPatternEntity {
  pattern_type?: string;
  description?: string;
  confidence_score?: number;
  frequency?: string;
  time_of_day?: string;
  day_of_week?: string;
}

// ============================================================================
// CUSTOM ENTITY TYPES (for Zep ontology)
// ============================================================================

/**
 * Calendar Event Entity
 * Represents scheduled events with energy levels and categorization
 */
export const CalendarEventEntity: EntityType = {
  description: "Represents a calendar event with scheduling and energy metadata",
  fields: {
    title: entityFields.text("Title of the calendar event"),
    category: entityFields.text("Event category (meeting, focus, break, personal, etc.)"),
    duration_minutes: entityFields.integer("Duration of the event in minutes"),
    energy_level: entityFields.text("Required energy level (high, medium, low)"),
    location: entityFields.text("Event location (physical or virtual)"),
    attendee_count: entityFields.integer("Number of attendees"),
  },
};

/**
 * Task Entity
 * Represents tasks with priority, satisfaction, and completion tracking
 */
export const TaskEntity: EntityType = {
  description: "Represents a task with priority and completion metadata",
  fields: {
    title: entityFields.text("Title of the task"),
    priority: entityFields.text("Task priority (urgent-important, important, urgent, low)"),
    category: entityFields.text("Task category aligned with goals"),
    estimated_duration: entityFields.integer("Estimated duration in minutes"),
    actual_duration: entityFields.integer("Actual time spent in minutes"),
    satisfaction_rating: entityFields.integer("User satisfaction rating (1-5) after completion"),
    energy_required: entityFields.text("Energy level required (high, medium, low)"),
  },
};

/**
 * Goal Entity
 * Represents user goals with progress tracking and deadlines
 */
export const GoalEntity: EntityType = {
  description: "Represents a user goal with progress tracking",
  fields: {
    title: entityFields.text("Goal title"),
    goal_type: entityFields.text("Type of goal (health, career, learning, relationships, etc.)"),
    status: entityFields.text("Current status (active, completed, paused, abandoned)"),
    progress_percentage: entityFields.float("Progress toward goal (0-100)"),
    deadline: entityFields.text("Goal deadline if applicable"),
    time_invested_minutes: entityFields.float("Total time invested toward this goal"),
  },
};

/**
 * Pattern Entity
 * Represents detected behavioral patterns with confidence scores
 */
export const PatternEntity: EntityType = {
  description: "Represents a detected behavioral pattern",
  fields: {
    pattern_type: entityFields.text("Type of pattern (productivity_peak, preferred_time, energy_cycle, etc.)"),
    description: entityFields.text("Human-readable description of the pattern"),
    confidence_score: entityFields.float("Confidence in this pattern (0.0-1.0)"),
    frequency: entityFields.text("How often this pattern occurs (daily, weekly, monthly)"),
    time_of_day: entityFields.text("Time of day this pattern applies (morning, afternoon, evening)"),
    day_of_week: entityFields.text("Day of week if applicable (Monday, Tuesday, etc.)"),
  },
};

/**
 * Time Block Entity
 * Represents preferred time blocks for different activity types
 */
export const TimeBlockEntity: EntityType = {
  description: "Represents a preferred time block for an activity type",
  fields: {
    activity_type: entityFields.text("Type of activity (deep_work, meetings, breaks, exercise, etc.)"),
    preferred_start_time: entityFields.text("Preferred start time (HH:MM format)"),
    preferred_duration: entityFields.float("Preferred duration in minutes"),
    energy_level: entityFields.text("Typical energy level during this time (high, medium, low)"),
    success_rate: entityFields.float("How often this preference is followed (0.0-1.0)"),
  },
};

/**
 * User Preference Entity
 * Represents explicit user preferences and settings
 */
export const UserPreferenceEntity: EntityType = {
  description: "Represents a user preference or setting",
  fields: {
    preference_type: entityFields.text("Type of preference (notification, scheduling, display, etc.)"),
    preference_key: entityFields.text("Specific preference identifier"),
    preference_value: entityFields.text("Preference value"),
    importance: entityFields.text("Importance level (high, medium, low)"),
  },
};

// ============================================================================
// CUSTOM EDGE TYPES
// ============================================================================

/**
 * SCHEDULED Edge
 * User scheduled a calendar event
 */
export const ScheduledRelation: EdgeType = {
  description: "Represents a user scheduling a calendar event",
  fields: {
    scheduled_at: entityFields.text("When the event was scheduled"),
    rescheduled_count: entityFields.float("Number of times rescheduled"),
    attendance_status: entityFields.text("User's attendance (attended, missed, cancelled)"),
  },
};

/**
 * COMPLETED_TASK Edge
 * User completed a task
 */
export const CompletedTaskRelation: EdgeType = {
  description: "Represents a user completing a task",
  fields: {
    completed_at: entityFields.text("When the task was completed"),
    time_to_complete: entityFields.float("Time taken to complete in minutes"),
    satisfaction_rating: entityFields.float("User satisfaction rating (1-5)"),
    energy_level_after: entityFields.text("Energy level after completion (high, medium, low)"),
  },
};

/**
 * PURSUING_GOAL Edge
 * User is actively pursuing a goal
 */
export const PursuingGoalRelation: EdgeType = {
  description: "Represents a user actively pursuing a goal",
  fields: {
    started_at: entityFields.text("When goal pursuit started"),
    last_worked_on: entityFields.text("Last time user worked on this goal"),
    total_sessions: entityFields.float("Number of work sessions on this goal"),
    momentum: entityFields.text("Current momentum (building, steady, declining)"),
  },
};

/**
 * HAS_PATTERN Edge
 * User exhibits a behavioral pattern
 */
export const HasPatternRelation: EdgeType = {
  description: "Represents a user exhibiting a behavioral pattern",
  fields: {
    first_detected: entityFields.text("When pattern was first detected"),
    last_observed: entityFields.text("Most recent observation of this pattern"),
    observation_count: entityFields.float("Number of times this pattern has been observed"),
    pattern_strength: entityFields.float("Strength of the pattern (0.0-1.0)"),
  },
};

/**
 * PREFERS_TIME Edge
 * User prefers certain time blocks for activities
 */
export const PrefersTimeRelation: EdgeType = {
  description: "Represents a user's time preference for an activity",
  fields: {
    established_at: entityFields.text("When this preference was established"),
    adherence_rate: entityFields.float("How often user follows this preference (0.0-1.0)"),
    last_followed: entityFields.text("Last time user followed this preference"),
  },
};

/**
 * COMMON_PATTERN Edge (Central Graph Only)
 * A pattern observed across multiple users
 */
export const CommonPatternRelation: EdgeType = {
  description: "Represents a pattern observed across multiple users",
  fields: {
    user_count: entityFields.float("Number of users exhibiting this pattern"),
    avg_confidence: entityFields.float("Average confidence score across users"),
    first_detected_across_users: entityFields.text("When this cross-user pattern was first detected"),
    pattern_category: entityFields.text("Category of pattern (productivity, scheduling, energy, etc.)"),
  },
};

// ============================================================================
// ONTOLOGY CONFIGURATION
// ============================================================================

/**
 * Entity type mapping for Zep
 */
export const ENTITY_TYPES = {
  CalendarEvent: CalendarEventEntity,
  Task: TaskEntity,
  Goal: GoalEntity,
  Pattern: PatternEntity,
  TimeBlock: TimeBlockEntity,
  UserPreference: UserPreferenceEntity,
};

/**
 * Edge type mapping for Zep
 * Note: source/target constraints are defined when calling setOntology
 */
export const EDGE_TYPES = {
  SCHEDULED: ScheduledRelation,
  COMPLETED_TASK: CompletedTaskRelation,
  PURSUING_GOAL: PursuingGoalRelation,
  HAS_PATTERN: HasPatternRelation,
  PREFERS_TIME: PrefersTimeRelation,
  COMMON_PATTERN: CommonPatternRelation,
};

/**
 * Central (group) graph identifier for cross-user patterns
 */
export const CENTRAL_GRAPH_ID = "central_user_patterns";
export const CENTRAL_GRAPH_NAME = "Global User Intelligence";

/**
 * Helper to format entity data for graph.add()
 */
export function formatEntityForGraph<T extends Record<string, any>>(
  entityType: string,
  entityData: T
) {
  return {
    data: JSON.stringify({
      entity_type: entityType,
      ...entityData
    }),
    type: 'json' as const,
    reference_time: new Date()
  };
}
