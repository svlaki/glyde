/**
 * ZepGraphService - Zep v3 Graph Memory with Full Feature Support
 *
 * Features:
 * - Custom ontology registration
 * - Dual-graph architecture (user graphs + central group graph)
 * - Fact rating system for quality filtering
 * - Hybrid BM25 + semantic search
 * - Temporal awareness and pattern aggregation
 * - Cross-user intelligence via central graph
 */

import { ZepClient } from '@getzep/zep-cloud';
import { env } from '../utils/env.js';
import {
  ENTITY_TYPES,
  EDGE_TYPES,
  CENTRAL_GRAPH_ID,
  CENTRAL_GRAPH_NAME,
  CalendarEventEntity,
  TaskEntity,
  GoalEntity,
  PatternEntity,
  TimeBlockEntity,
  UserPreferenceEntity,
  ScheduledRelation,
  CompletedTaskRelation,
  PursuingGoalRelation,
  HasPatternRelation,
  PrefersTimeRelation,
  CommonPatternRelation,
  formatEntityForGraph,
  type ICalendarEventEntity,
  type ITaskEntity,
  type IGoalEntity,
  type IPatternEntity,
} from '../types/zep-ontology.js';

// Legacy exports for backward compatibility
export type { ICalendarEventEntity as CalendarEventEntity, ITaskEntity as TaskEntity, IGoalEntity as GoalEntity } from '../types/zep-ontology.js';

export interface UserPreferenceEntity {
  type: 'UserPreference';
  category: string;
  preference: string;
  value: any;
  confidence: number;
  lastUpdated: string;
}

// Graph search result types
export interface GraphSearchResult {
  edges: any[];
  nodes: any[];
  episodes: any[];
}

export interface MemoryContext {
  facts: any[];
  memory_context: string;
  entities: any[];
}

export interface PatternAggregation {
  userIds: string[];
  avgConfidence: number;
  observations: any[];
}

/**
 * Main Zep Graph Service - Manages dual-graph knowledge architecture
 */
export class ZepGraphService {
  private client: ZepClient;
  private userThreads: Map<string, string> = new Map();
  private ontologyInitialized: boolean = false;
  private centralGraphInitialized: boolean = false;

  constructor() {
    if (!env.ZEP_API_KEY) {
      throw new Error('ZEP_API_KEY environment variable is required');
    }

    this.client = new ZepClient({
      apiKey: env.ZEP_API_KEY,
    });

    // Initialize infrastructure asynchronously
    this.initializeInfrastructure().catch(err =>
      console.error('Failed to initialize Zep infrastructure:', err)
    );
  }

  /**
   * Initialize Zep infrastructure: ontology and central graph
   */
  private async initializeInfrastructure(): Promise<void> {
    try {
      await this.initializeOntology();
      await this.initializeCentralGraph();
      console.log('✅ [ZepGraphService] Infrastructure initialized successfully');
    } catch (error) {
      console.error('❌ [ZepGraphService] Infrastructure initialization failed:', error);
    }
  }

  /**
   * Register custom ontology with Zep
   * Defines entity and edge types for automatic extraction and structured storage
   */
  async initializeOntology(): Promise<void> {
    if (this.ontologyInitialized) return;

    try {
      await this.client.graph.setOntology(
        {
          CalendarEvent: CalendarEventEntity,
          Task: TaskEntity,
          Goal: GoalEntity,
          Pattern: PatternEntity,
          TimeBlock: TimeBlockEntity,
          UserPreference: UserPreferenceEntity,
        },
        {
          SCHEDULED: {
            ...ScheduledRelation,
            sourceTargets: [{ source: "User", target: "CalendarEvent" }]
          },
          COMPLETED_TASK: {
            ...CompletedTaskRelation,
            sourceTargets: [{ source: "User", target: "Task" }]
          },
          PURSUING_GOAL: {
            ...PursuingGoalRelation,
            sourceTargets: [{ source: "User", target: "Goal" }]
          },
          HAS_PATTERN: {
            ...HasPatternRelation,
            sourceTargets: [{ source: "User", target: "Pattern" }]
          },
          PREFERS_TIME: {
            ...PrefersTimeRelation,
            sourceTargets: [{ source: "User", target: "TimeBlock" }]
          },
          COMMON_PATTERN: {
            ...CommonPatternRelation,
            sourceTargets: [{ source: "Pattern", target: "Pattern" }]
          },
        }
      );

      this.ontologyInitialized = true;
      console.log('✅ [ZepGraphService] Custom ontology registered successfully');
    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to register ontology:', error);
      throw error;
    }
  }

  /**
   * Create central group graph for cross-user patterns and collective intelligence
   */
  async initializeCentralGraph(): Promise<void> {
    if (this.centralGraphInitialized) return;

    try {
      // Check if central graph exists
      try {
        await this.client.graph.get(CENTRAL_GRAPH_ID);
        console.log('✅ [ZepGraphService] Central graph already exists');
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.status === 404) {
          // Create central graph
          await this.client.graph.create({
            graphId: CENTRAL_GRAPH_ID,
            name: CENTRAL_GRAPH_NAME,
            description: "Centralized knowledge graph for cross-user patterns, insights, and collective intelligence"
          });
          console.log('✅ [ZepGraphService] Central graph created successfully');
        } else {
          throw error;
        }
      }

      this.centralGraphInitialized = true;
    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to initialize central graph:', error);
      throw error;
    }
  }

  /**
   * Initialize user with fact rating configuration
   */
  async initializeUserWithRatings(
    userId: string,
    userData?: { first_name?: string; last_name?: string; email?: string }
  ): Promise<void> {
    try {
      await this.client.user.add({
        userId: userId,
        ...userData,
        factRatingInstruction: {
          instruction: `Rate facts by confidence and relevance for personal intelligence:
- Pattern facts: Rate by observation count and consistency (0.8-1.0 = strong pattern, 15+ observations)
- Event facts: Rate by recency and completion (0.6-0.9 = verified events)
- Goal facts: Rate by progress and engagement (0.7-1.0 = active goals with progress)
- Preference facts: Rate by adherence rate (0.5-1.0 = validated preferences)
- Task facts: Rate by completion and satisfaction (0.6-0.9 = completed with feedback)`,
          examples: {
            high: "User completes deep work at 9am every weekday (observed 15 times, 95% consistency)",
            medium: "User prefers afternoon meetings (observed 8 times, 70% adherence)",
            low: "User tried morning exercise once (observed 1 time, 30% confidence)"
          }
        }
      });
      console.log(`✅ [ZepGraphService] User initialized with fact ratings: ${userId}`);
    } catch (error: any) {
      // User already exists - check for both 409 and 400 with "already exists" message
      const isAlreadyExists = 
        error?.statusCode === 409 || 
        error?.status === 409 ||
        (error?.statusCode === 400 && error?.body?.message?.includes('already exists')) ||
        (error?.status === 400 && error?.body?.message?.includes('already exists'));
      
      if (!isAlreadyExists) {
        console.error(`❌ [ZepGraphService] Failed to initialize user ${userId}:`, error);
        throw error;
      }
      // User already exists, continue silently
      console.log(`✅ [ZepGraphService] User already exists: ${userId}`);
    }
  }

  /**
   * Get or create a thread for a user
   */
  private async getOrCreateThread(userId: string): Promise<string> {
    const existingThreadId = this.userThreads.get(userId);
    if (existingThreadId) {
      return existingThreadId;
    }

    const threadId = `user-context-${userId}`;

    try {
      // Ensure user exists with ratings
      await this.initializeUserWithRatings(userId);

      // Create thread
      await this.client.thread.create({
        threadId: threadId,
        userId: userId
      });

      this.userThreads.set(userId, threadId);
      console.log(`✅ [ZepGraphService] Created thread: ${threadId}`);
      return threadId;
    } catch (error: any) {
      // Thread already exists - check for both 409 and 400 with "already exists" message
      const isAlreadyExists = 
        error?.statusCode === 409 || 
        error?.status === 409 ||
        (error?.statusCode === 400 && error?.body?.message?.includes('already exists')) ||
        (error?.status === 400 && error?.body?.message?.includes('already exists'));
      
      if (isAlreadyExists) {
        this.userThreads.set(userId, threadId);
        console.log(`✅ [ZepGraphService] Thread already exists: ${threadId}`);
        return threadId;
      }
      
      throw error;
    }
  }

  // ============================================================================
  // USER GRAPH OPERATIONS - Calendar Events
  // ============================================================================

  /**
   * Add calendar event to user's graph using graph.add()
   */
  async addCalendarEvent(userId: string, event: Partial<ICalendarEventEntity>): Promise<string> {
    try {
      // Add event to user's graph as structured data (no thread needed)
      await this.client.graph.add({
        userId: userId,
        ...formatEntityForGraph('CalendarEvent', {
          supabase_id: event.eventId,  // Store Supabase UUID for precise matching
          title: event.title,
          category: event.category || 'personal',
          duration_minutes: event.duration_minutes,
          energy_level: event.energy_level || 'medium',
          location: event.location,
          attendee_count: event.attendee_count || 0,
        })
      });

      console.log(`✅ [ZepGraphService] Added calendar event to user graph: ${event.title}`);
      return event.eventId || '';
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to add calendar event:`, error);
      throw error;
    }
  }

  /**
   * Update calendar event in user's graph
   * Zep's temporal awareness automatically invalidates old facts
   */
  async updateCalendarEvent(userId: string, eventId: string, updatedEvent: Partial<ICalendarEventEntity>): Promise<void> {
    try {
      // Adding new data automatically invalidates old facts with same entities
      await this.client.graph.add({
        userId: userId,
        ...formatEntityForGraph('CalendarEvent', {
          title: updatedEvent.title,
          category: updatedEvent.category,
          duration_minutes: updatedEvent.duration_minutes,
          energy_level: updatedEvent.energy_level,
          location: updatedEvent.location,
          attendee_count: updatedEvent.attendee_count,
        })
      });

      console.log(`✅ [ZepGraphService] Updated calendar event: ${updatedEvent.title}`);
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to update calendar event:`, error);
      throw error;
    }
  }

  /**
   * Delete calendar event (mark as invalidated)
   * Uses temporal invalidation by adding a deletion fact to the graph
   */
  async deleteCalendarEvent(userId: string, eventId: string, eventTitle?: string): Promise<void> {
    try {
      // Add invalidation fact to the graph
      // Zep's temporal system will use this to mark the event as no longer valid
      await this.client.graph.add({
        userId: userId,
        data: `The calendar event "${eventTitle || eventId}" (ID: ${eventId}) has been deleted and is no longer scheduled. This event should be considered cancelled and removed from the user's schedule.`,
        type: 'text',
      });
      console.log(`✅ [ZepGraphService] Calendar event invalidated in graph: ${eventId}`);
    } catch (error) {
      console.error(`⚠️ [ZepGraphService] Failed to invalidate calendar event ${eventId}:`, error);
      // Non-critical - deletion from DB is what matters, graph invalidation is secondary
    }
  }

  // ============================================================================
  // USER GRAPH OPERATIONS - Tasks
  // ============================================================================

  /**
   * Add task to user's graph
   */
  async addTask(userId: string, task: Partial<ITaskEntity>): Promise<string> {
    try {
      await this.client.graph.add({
        userId: userId,
        ...formatEntityForGraph('Task', {
          supabase_id: task.taskId,  // Store Supabase UUID for precise matching
          title: task.title,
          priority: task.priority || 'medium',
          category: task.category,
          estimated_duration: task.estimated_duration,
          actual_duration: task.actual_duration,
          satisfaction_rating: task.satisfaction_rating,
          energy_required: task.energy_required || 'medium',
        })
      });

      console.log(`✅ [ZepGraphService] Added task to user graph: ${task.title}`);
      return task.taskId || '';
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to add task:`, error);
      throw error;
    }
  }

  /**
   * Delete task (mark as invalidated)
   * Uses temporal invalidation by adding a deletion fact to the graph
   */
  async deleteTask(userId: string, taskId: string, taskTitle?: string): Promise<void> {
    try {
      // Add invalidation fact to the graph
      // Zep's temporal system will use this to mark the task as no longer valid
      await this.client.graph.add({
        userId: userId,
        data: `The task "${taskTitle || taskId}" (ID: ${taskId}) has been deleted and is no longer active. This task should be considered removed from the user's task list.`,
        type: 'text',
      });
      console.log(`✅ [ZepGraphService] Task invalidated in graph: ${taskId}`);
    } catch (error) {
      console.error(`⚠️ [ZepGraphService] Failed to invalidate task ${taskId}:`, error);
      // Non-critical - deletion from DB is what matters, graph invalidation is secondary
    }
  }

  // ============================================================================
  // USER GRAPH OPERATIONS - Goals
  // ============================================================================

  /**
   * Add goal to user's graph
   */
  async addGoal(userId: string, goal: Partial<IGoalEntity>): Promise<string> {
    try {
      await this.client.graph.add({
        userId: userId,
        ...formatEntityForGraph('Goal', {
          supabase_id: goal.goalId,  // Store Supabase UUID for precise matching
          title: goal.title,
          goal_type: goal.goal_type,
          status: goal.status || 'active',
          progress_percentage: goal.progress_percentage || 0,
          deadline: goal.deadline,
          time_invested_minutes: goal.time_invested_minutes || 0,
        })
      });

      console.log(`✅ [ZepGraphService] Added goal to user graph: ${goal.title}`);
      return goal.goalId || '';
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to add goal:`, error);
      throw error;
    }
  }

  /**
   * Delete goal (mark as invalidated)
   * Uses temporal invalidation by adding a deletion fact to the graph
   */
  async deleteGoal(userId: string, goalId: string, goalTitle?: string): Promise<void> {
    try {
      // Add invalidation fact to the graph
      // Zep's temporal system will use this to mark the goal as no longer valid
      await this.client.graph.add({
        userId: userId,
        data: `The goal "${goalTitle || goalId}" (ID: ${goalId}) has been deleted and is no longer being pursued. This goal should be considered removed from the user's goals.`,
        type: 'text',
      });
      console.log(`✅ [ZepGraphService] Goal invalidated in graph: ${goalId}`);
    } catch (error) {
      console.error(`⚠️ [ZepGraphService] Failed to invalidate goal ${goalId}:`, error);
      // Non-critical - deletion from DB is what matters, graph invalidation is secondary
    }
  }

  // ============================================================================
  // USER GRAPH OPERATIONS - Patterns
  // ============================================================================

  /**
   * Add detected behavioral pattern to user's graph
   */
  async addUserPattern(userId: string, pattern: Partial<IPatternEntity> & { pattern_key?: string }): Promise<void> {
    try {
      await this.client.graph.add({
        userId: userId,
        ...formatEntityForGraph('Pattern', {
          pattern_key: pattern.pattern_key,  // Unique key for deduplication
          pattern_type: pattern.pattern_type,
          description: pattern.description,
          confidence_score: pattern.confidence_score || 0.5,
          frequency: pattern.frequency || 'daily',
          time_of_day: pattern.time_of_day,
          day_of_week: pattern.day_of_week,
        })
      });

      console.log(`✅ [ZepGraphService] Added pattern to user graph: ${pattern.pattern_type}`);
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to add pattern:`, error);
      throw error;
    }
  }


  /**
   * Add user preference to user's graph (used for onboarding data)
   */
  async addUserPreference(userId: string, preference: {
    preference_type: string;
    key: string;
    value: string;
    importance: string;
  }): Promise<void> {
    try {
      await this.client.graph.add({
        userId: userId,
        ...formatEntityForGraph('UserPreference', {
          preference_type: preference.preference_type,
          preference_key: preference.key,
          preference_value: preference.value,
          importance: preference.importance,
        })
      });

      console.log(`✅ [ZepGraphService] Added user preference: ${preference.key}`);
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to add user preference:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CENTRAL GRAPH OPERATIONS - Cross-User Patterns
  // ============================================================================

  /**
   * Add community pattern to central graph
   */
  async addCommunityPattern(pattern: {
    pattern_type: string;
    description: string;
    user_count: number;
    avg_confidence: number;
    pattern_category: string;
  }): Promise<void> {
    try {
      await this.initializeCentralGraph();

      await this.client.graph.add({
        graphId: CENTRAL_GRAPH_ID,
        ...formatEntityForGraph('Pattern', {
          pattern_type: pattern.pattern_type,
          description: pattern.description,
          confidence_score: pattern.avg_confidence,
          frequency: 'cross_user',
        })
      });

      console.log(`✅ [ZepGraphService] Added community pattern: ${pattern.pattern_type} (${pattern.user_count} users)`);
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to add community pattern:`, error);
      throw error;
    }
  }

  // ============================================================================
  // ADVANCED SEARCH - Hybrid BM25 + Semantic
  // ============================================================================

  /**
   * Search user graph with hybrid semantic + BM25 search
   */
  async searchUserGraphAdvanced(
    userId: string,
    query: string,
    options?: {
      reranker?: 'rrf' | 'mmr' | 'cross_encoder';
      minRating?: number;
      entityTypes?: string[];
      edgeTypes?: string[];
      scope?: 'edges' | 'nodes' | 'episodes';
    }
  ): Promise<GraphSearchResult> {
    try {
      const result = await this.client.graph.search({
        userId: userId,
        query: query,
        scope: options?.scope || 'edges',
        reranker: options?.reranker || 'rrf', // Hybrid semantic + BM25
        minFactRating: options?.minRating || 0.5,
        searchFilters: {
          nodeLabels: options?.entityTypes,
          edgeTypes: options?.edgeTypes,
        }
      });

      console.log(`✅ [ZepGraphService] User graph search completed: ${query}`);
      return {
        edges: result.edges || [],
        nodes: result.nodes || [],
        episodes: result.episodes || []
      };
    } catch (error) {
      console.error(`❌ [ZepGraphService] Search failed:`, error);
      return { edges: [], nodes: [], episodes: [] };
    }
  }

  /**
   * Search high-quality patterns only (min rating 0.7)
   */
  async searchHighQualityPatterns(userId: string, query: string): Promise<GraphSearchResult> {
    return this.searchUserGraphAdvanced(userId, query, {
      minRating: 0.7,
      edgeTypes: ['HAS_PATTERN', 'PREFERS_TIME'],
      scope: 'edges'
    });
  }

  /**
   * Search central graph for community insights
   */
  async searchCommunityPatterns(query: string, minUserCount: number = 3): Promise<string[]> {
    try {
      const result = await this.client.graph.search({
        graphId: CENTRAL_GRAPH_ID,
        query: query,
        scope: 'edges',
        minFactRating: 0.7,
        searchFilters: {
          edgeTypes: ['COMMON_PATTERN']
        }
      });

      return (result.edges || [])
        .filter((e: any) => (e.fact?.user_count || 0) >= minUserCount)
        .map((e: any) =>
          `${e.fact?.description} (${e.fact?.user_count} users, ${(e.fact?.confidence_score || 0).toFixed(2)} confidence)`
        );
    } catch (error) {
      console.error(`❌ [ZepGraphService] Community search failed:`, error);
      return [];
    }
  }

  // ============================================================================
  // UNIFIED MEMORY CONTEXT
  // ============================================================================

  /**
   * Get enhanced user context combining thread + user graph + community insights
   */
  async getEnhancedUserContext(userId: string, sessionId: string): Promise<MemoryContext> {
    try {
      // Get user graph patterns
      const userPatterns = await this.searchHighQualityPatterns(
        userId,
        'productivity scheduling preferences goals habits'
      );

      // Get community insights
      const communityInsights = await this.searchCommunityPatterns(
        'productivity peak hours scheduling best practices',
        5 // minimum 5 users
      );

      // Combine into comprehensive context
      const patternContext = userPatterns.edges
        .map((e: any) => `- ${e.fact?.description} (${(e.fact?.confidence_score || 0).toFixed(2)} confidence)`)
        .join('\n');

      const enhancedContext = `
**Your Personal Patterns:**
${patternContext || 'No strong patterns detected yet.'}

**Community Insights (What Works for Others):**
${communityInsights.length > 0 ? communityInsights.join('\n') : 'Building community insights...'}
      `.trim();

      return {
        facts: [],
        memory_context: enhancedContext,
        entities: []
      };
    } catch (error) {
      console.error(`❌ [ZepGraphService] Failed to get enhanced context:`, error);
      return {
        facts: [],
        memory_context: '',
        entities: []
      };
    }
  }

  // ============================================================================
  // LEGACY COMPATIBILITY
  // ============================================================================

  /**
   * Legacy search method for backward compatibility
   */
  async searchEntities(userId: string, query: string, entityType?: string, limit: number = 10): Promise<any[]> {
    const result = await this.searchUserGraphAdvanced(userId, query, {
      entityTypes: entityType ? [entityType] : undefined,
      scope: 'nodes'
    });
    return result.nodes.slice(0, limit);
  }

  /**
   * Clean up user graph
   */
  async cleanupUserGraph(userId: string): Promise<void> {
    try {
      await this.client.user.delete(userId);
      this.userThreads.delete(userId);
      console.log(`✅ [ZepGraphService] Cleaned up user graph: ${userId}`);
    } catch (error) {
      console.error(`❌ [ZepGraphService] Cleanup failed:`, error);
    }
  }
}
