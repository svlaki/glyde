import { ZepClient } from '@getzep/zep-cloud';
import { EntityMappingService, type EntityMapping } from './EntityMappingService.js';

// Custom entity types for structured data in the knowledge graph
export interface CalendarEventEntity {
  type: 'CalendarEvent';
  eventId: string;  // Link to Supabase event ID
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
  category?: string;
  energyLevel?: string;
  participants?: string[];
  topics?: string[];
  createdAt: string;
}

export interface TaskEntity {
  type: 'Task';
  taskId: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  dueDate?: string;
  createdAt: string;
}

export interface GoalEntity {
  type: 'Goal';
  goalId: string;
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  progress: number;
  createdAt: string;
}

export interface UserPreferenceEntity {
  type: 'UserPreference';
  category: string;
  preference: string;
  value: any;
  confidence: number;
  lastUpdated: string;
}

// Graph entity relationships
export interface AttendanceRelation {
  type: 'ATTENDS';
  person: string;
  role?: string;
}

export interface LocationRelation {
  type: 'LOCATED_AT';
  location: string;
}

export interface TimeRelation {
  type: 'SCHEDULED_FOR';
  timeSlot: string;
  duration?: number;
}

export interface DependencyRelation {
  type: 'DEPENDS_ON';
  dependency: string;
  dependencyType: string;
}

export class ZepGraphService {
  private client: ZepClient;
  private mappingService: EntityMappingService;
  private userThreads: Map<string, string> = new Map();

  constructor() {
    if (!process.env.ZEP_API_KEY) {
      throw new Error('ZEP_API_KEY environment variable is required');
    }

    this.client = new ZepClient({
      apiKey: process.env.ZEP_API_KEY,
    });

    this.mappingService = new EntityMappingService();
  }

  /**
   * Get or create a thread for a user (shared with ZepMemoryService pattern)
   */
  private async getOrCreateThread(userId: string): Promise<string> {
    const existingThreadId = this.userThreads.get(userId);
    if (existingThreadId) {
      return existingThreadId;
    }

    // Use consistent thread ID format
    const threadId = `calendar-events-${userId}`;

    try {
      // Ensure user exists
      try {
        await this.client.user.get(userId);
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.status === 404) {
          await this.client.user.add({ userId });
          console.log(`✨ [ZepGraphService] Created user: ${userId}`);
        }
      }

      // Create thread
      await this.client.thread.create({
        threadId: threadId,
        userId: userId
      });

      this.userThreads.set(userId, threadId);
      console.log(`✨ [ZepGraphService] Created thread: ${threadId}`);
      return threadId;
    } catch (error: any) {
      // Thread might already exist
      if (error?.statusCode === 409 || error?.status === 409) {
        this.userThreads.set(userId, threadId);
        return threadId;
      }
      throw error;
    }
  }

  /**
   * Add a calendar event entity to the knowledge graph using thread.add_messages
   * This provides better entity extraction and temporal awareness
   */
  async addCalendarEvent(userId: string, event: CalendarEventEntity): Promise<string> {
    // Graphiti disabled - skip knowledge graph operations
    console.log(`⏭️  [ZepGraphService] Graphiti disabled - skipping calendar event "${event.title}"`);
    return '';
  }

  /**
   * Update a calendar event entity in the knowledge graph
   * Zep uses temporal awareness - adding a new message automatically invalidates old facts
   */
  async updateCalendarEvent(userId: string, eventId: string, updatedEvent: CalendarEventEntity): Promise<void> {
    // Graphiti disabled - skip knowledge graph operations
    console.log(`⏭️  [ZepGraphService] Graphiti disabled - skipping calendar event update "${updatedEvent.title}"`);
  }

  /**
   * Delete a calendar event entity from the knowledge graph
   */
  async deleteCalendarEvent(eventId: string): Promise<void> {
    // Graphiti disabled - skip knowledge graph operations
    console.log(`⏭️  [ZepGraphService] Graphiti disabled - skipping calendar event delete ${eventId}`);
  }

  /**
   * Add a task entity to the knowledge graph using thread.add_messages
   */
  async addTask(userId: string, task: TaskEntity): Promise<string> {
    // Graphiti disabled - skip knowledge graph operations
    console.log(`⏭️  [ZepGraphService] Graphiti disabled - skipping task "${task.title}"`);
    return '';
  }

  /**
   * Clean up all graph data for a user
   * This deletes the user from Zep (which removes all their episodes/facts)
   * and clears all entity mappings from Supabase
   */
  async cleanupUserGraph(userId: string): Promise<void> {
    // Graphiti disabled - skip knowledge graph operations
    console.log(`⏭️  [ZepGraphService] Graphiti disabled - skipping cleanup for user ${userId}`);
  }

  /**
   * Search for entities in the knowledge graph
   */
  async searchEntities(userId: string, query: string, entityType?: string, limit: number = 10): Promise<any[]> {
    // Graphiti disabled - skip knowledge graph operations
    console.log(`⏭️  [ZepGraphService] Graphiti disabled - skipping entity search for "${query}"`);
    return [];
  }

  /**
   * Get entity mapping by ID
   */
  async getEntityMapping(entityType: string, entityId: string): Promise<EntityMapping | null> {
    return await this.mappingService.getMapping(entityType, entityId);
  }
}