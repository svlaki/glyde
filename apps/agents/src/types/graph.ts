/**
 * Zep Graph Types and Custom Ontology Definitions
 *
 * Defines custom entity and edge types for the Personal Intelligence Operating System's
 * dual-graph memory architecture (user graphs + group graph)
 */

// ============================================================================
// Custom Entity Types (Nodes in the Knowledge Graph)
// ============================================================================

/**
 * Calendar Event Entity
 * Represents scheduled events in a user's calendar
 */
export interface CalendarEventEntity {
  title: string;
  start_time: string; // ISO 8601 timestamp
  end_time: string; // ISO 8601 timestamp
  duration_minutes: number;
  category: 'meeting' | 'deep_work' | 'personal' | 'break' | 'other';
  energy_level?: 'low' | 'medium' | 'high';
  location?: string;
  attendees?: number;
}

/**
 * Task Entity
 * Represents tasks with priority and completion tracking
 */
export interface TaskEntity {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number;
  energy_level_required?: 'low' | 'medium' | 'high';
  completion_date?: string; // ISO 8601 timestamp
  satisfaction_rating?: number; // 1-5
}

/**
 * Goal Entity
 * Represents user goals with progress tracking
 */
export interface GoalEntity {
  title: string;
  goal_type: 'short_term' | 'long_term' | 'habit';
  deadline?: string; // ISO 8601 timestamp
  progress_percentage: number; // 0-100
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  category?: string;
}

/**
 * Time Block Entity
 * Represents preferred time blocks for certain activities
 */
export interface TimeBlockEntity {
  block_type: 'deep_work' | 'meetings' | 'admin' | 'personal' | 'break';
  start_hour: number; // 0-23
  end_hour: number; // 0-23
  productivity_rating?: number; // 1-5
  frequency: 'daily' | 'weekly' | 'occasional';
}

/**
 * Pattern Entity
 * Represents detected behavioral or productivity patterns
 */
export interface PatternEntity {
  pattern_type:
    | 'peak_productivity_hours'
    | 'meeting_overload'
    | 'task_completion_rate'
    | 'goal_achievement'
    | 'energy_fluctuation'
    | 'scheduling_preference'
    | 'other';
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'rare';
  confidence_score: number; // 0-1
  first_detected: string; // ISO 8601 timestamp
  last_observed: string; // ISO 8601 timestamp
  user_count?: number; // For group graph patterns
}

// ============================================================================
// Custom Edge Types (Relationships in the Knowledge Graph)
// ============================================================================

/**
 * SCHEDULED Edge
 * User scheduled a calendar event
 */
export interface ScheduledEdge {
  scheduled_at: string; // When the scheduling action occurred
  scheduling_lead_time_hours?: number; // How far in advance it was scheduled
  was_rescheduled?: boolean;
}

/**
 * COMPLETED_TASK Edge
 * User completed a task
 */
export interface CompletedTaskEdge {
  completed_at: string; // ISO 8601 timestamp
  time_taken_minutes?: number;
  satisfaction_rating?: number; // 1-5
  on_time: boolean;
}

/**
 * PURSUING_GOAL Edge
 * User is actively pursuing a goal
 */
export interface PursuingGoalEdge {
  started_at: string; // ISO 8601 timestamp
  progress_percentage: number; // 0-100
  last_updated: string; // ISO 8601 timestamp
}

/**
 * HAS_PATTERN Edge
 * User exhibits a behavioral pattern
 */
export interface HasPatternEdge {
  first_detected: string; // ISO 8601 timestamp
  last_observed: string; // ISO 8601 timestamp
  occurrence_count: number;
  confidence: number; // 0-1
}

/**
 * PREFERS Edge
 * User prefers a certain time block for activities
 */
export interface PrefersEdge {
  preference_strength: number; // 0-1
  times_used: number;
  average_productivity?: number; // 1-5
}

/**
 * COMMON_PATTERN Edge (Group Graph)
 * Correlation between patterns across users
 */
export interface CommonPatternEdge {
  correlation_strength: number; // 0-1
  user_count: number;
  statistical_significance: number; // p-value
}

// ============================================================================
// Zep Graph Data Structures
// ============================================================================

/**
 * Episode data for adding to graphs
 */
export interface GraphEpisodeData {
  data: string; // JSON stringified or text
  type: 'text' | 'json' | 'message';
  reference_time?: Date;
}

/**
 * Graph search filters
 */
export interface GraphSearchFilters {
  nodeLabels?: string[];
  edgeTypes?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
}

/**
 * Graph search result
 */
export interface GraphSearchResult {
  edges?: GraphEdge[];
  nodes?: GraphNode[];
  episodes?: GraphEpisode[];
}

/**
 * Graph node (entity)
 */
export interface GraphNode {
  uuid: string;
  name: string;
  labels: string[];
  summary?: string;
  created_at?: string;
  [key: string]: any; // Custom attributes
}

/**
 * Graph edge (relationship/fact)
 */
export interface GraphEdge {
  uuid: string;
  fact: string;
  edge_type?: string;
  source_node_uuid: string;
  target_node_uuid?: string;
  valid_at?: string;
  invalid_at?: string;
  [key: string]: any; // Custom attributes
}

/**
 * Graph episode
 */
export interface GraphEpisode {
  uuid: string;
  created_at: string;
  content?: string;
  type?: string;
}

// ============================================================================
// Ontology Configuration
// ============================================================================

/**
 * Complete ontology definition for Zep
 */
export interface ZepOntologyConfig {
  entities: {
    CalendarEvent: CalendarEventEntity;
    Task: TaskEntity;
    Goal: GoalEntity;
    TimeBlock: TimeBlockEntity;
    Pattern: PatternEntity;
  };
  edges: {
    SCHEDULED: {
      model: ScheduledEdge;
      sourceTargets: Array<{ source: string; target: string }>;
    };
    COMPLETED_TASK: {
      model: CompletedTaskEdge;
      sourceTargets: Array<{ source: string; target: string }>;
    };
    PURSUING_GOAL: {
      model: PursuingGoalEdge;
      sourceTargets: Array<{ source: string; target: string }>;
    };
    HAS_PATTERN: {
      model: HasPatternEdge;
      sourceTargets: Array<{ source: string; target: string }>;
    };
    PREFERS: {
      model: PrefersEdge;
      sourceTargets: Array<{ source: string; target: string }>;
    };
    COMMON_PATTERN: {
      model: CommonPatternEdge;
      sourceTargets: Array<{ source: string; target: string }>;
    };
  };
}

// ============================================================================
// Group Graph Constants
// ============================================================================

/**
 * Group graph ID for shared patterns and insights
 */
export const GROUP_GRAPH_ID = 'global_user_patterns';

/**
 * Group graph metadata
 */
export const GROUP_GRAPH_CONFIG = {
  id: GROUP_GRAPH_ID,
  name: 'Global User Patterns',
  description: 'Shared intelligence and patterns across all users of the Personal Intelligence Operating System'
};
