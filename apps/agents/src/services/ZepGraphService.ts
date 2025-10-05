import { ZepClient } from '@getzep/zep-cloud';
import { EntityMappingService, type EntityMapping } from './EntityMappingService.js';
import { env } from '../utils/env.js';

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

  constructor() {
    if (!env.ZEP_API_KEY) {
      throw new Error('ZEP_API_KEY environment variable is required');
    }

    this.client = new ZepClient({
      apiKey: env.ZEP_API_KEY,
    });

    this.mappingService = new EntityMappingService();
  }


  /**
   * Add a calendar event entity to the knowledge graph
   */
  async addCalendarEvent(userId: string, event: CalendarEventEntity): Promise<string> {
    try {
      console.log(`🔗 [ZepGraphService] Adding calendar event "${event.title}" to knowledge graph`);


      // Add to graph using correct Zep API
      const response = await this.client.graph.add({
        userId: userId,
        type: 'json',
        data: JSON.stringify({
          event_type: 'calendar_event_created',
          entity_type: 'CalendarEvent',
          entity_data: {
            eventId: event.eventId,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            description: event.description,
            category: event.category,
            energyLevel: event.energyLevel,
            participants: event.participants || [],
            topics: event.topics || [],
            createdAt: event.createdAt
          },
          content: `Calendar event: ${event.title}. Category: ${event.category || 'Personal'}. ${event.startTime} - ${event.endTime || ''}${event.location ? `. Location: ${event.location}` : ''}${event.description ? `. ${event.description}` : ''}`
        })
      });

      // Track the entity mapping - use the response UUID
      const graphUuid = response.uuid;
      await this.mappingService.storeMapping(userId, 'CalendarEvent', event.eventId, graphUuid);

      console.log(`✅ [ZepGraphService] Calendar event added to graph with UUID: ${graphUuid}`);
      return graphUuid;

    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to add calendar event to graph:', error);
      throw error;
    }
  }

  /**
   * Update a calendar event entity in the knowledge graph
   */
  async updateCalendarEvent(userId: string, eventId: string, updates: Partial<CalendarEventEntity>): Promise<void> {
    try {
      console.log(`🔄 [ZepGraphService] Updating calendar event ${eventId} in knowledge graph`);

      const mapping = await this.mappingService.getMapping('CalendarEvent', eventId);

      if (!mapping) {
        console.warn(`⚠️ [ZepGraphService] No graph mapping found for event ${eventId}, skipping graph update`);
        return;
      }

      // For now, we'll delete the old entity and create a new one
      // This is because Zep doesn't have direct entity update - it works through episodes
      await this.deleteCalendarEvent(eventId);

      // Re-create with updated data
      if (updates.eventId) {
        const fullEvent: CalendarEventEntity = {
          type: 'CalendarEvent',
          eventId: updates.eventId,
          title: updates.title || 'Updated Event',
          startTime: updates.startTime || new Date().toISOString(),
          endTime: updates.endTime,
          location: updates.location,
          description: updates.description,
          category: updates.category,
          energyLevel: updates.energyLevel,
          participants: updates.participants,
          topics: updates.topics,
          createdAt: updates.createdAt || new Date().toISOString()
        };

        await this.addCalendarEvent(userId, fullEvent);
      }

    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to update calendar event in graph:', error);
      throw error;
    }
  }

  /**
   * Delete a calendar event entity from the knowledge graph
   */
  async deleteCalendarEvent(eventId: string): Promise<void> {
    try {
      console.log(`🗑️ [ZepGraphService] Deleting calendar event ${eventId} from knowledge graph`);

      const mapping = await this.mappingService.getMapping('CalendarEvent', eventId);

      if (!mapping) {
        console.warn(`⚠️ [ZepGraphService] No graph mapping found for event ${eventId}, nothing to delete`);
        return;
      }

      // Delete the episode from the graph using the stored UUID
      await this.client.graph.episode.delete(mapping.graphUuid);

      // Remove from our mapping
      await this.mappingService.deleteMapping('CalendarEvent', eventId);

      console.log(`✅ [ZepGraphService] Calendar event deleted from graph`);

    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to delete calendar event from graph:', error);
      throw error;
    }
  }

  /**
   * Add a task entity to the knowledge graph
   */
  async addTask(userId: string, task: TaskEntity): Promise<string> {
    try {
      console.log(`🔗 [ZepGraphService] Adding task "${task.title}" to knowledge graph`);


      // Add to graph using correct Zep API
      const response = await this.client.graph.add({
        userId: userId,
        type: 'json',
        data: JSON.stringify({
          event_type: 'task_created',
          entity_type: 'Task',
          entity_data: {
            taskId: task.taskId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate,
            createdAt: task.createdAt
          },
          content: `Task created: ${task.title}. Priority: ${task.priority}, Status: ${task.status}${task.dueDate ? `, Due: ${task.dueDate}` : ''}`
        })
      });

      const graphUuid = response.uuid;
      await this.mappingService.storeMapping(userId, 'Task', task.taskId, graphUuid);

      console.log(`✅ [ZepGraphService] Task added to graph with UUID: ${graphUuid}`);
      return graphUuid;

    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to add task to graph:', error);
      throw error;
    }
  }

  /**
   * Search for entities in the knowledge graph
   */
  async searchEntities(userId: string, query: string, entityType?: string, limit: number = 10): Promise<any[]> {
    try {
      console.log(`🔍 [ZepGraphService] Searching for entities: "${query}"`);

      // Search the graph using correct Zep API
      const searchResponse = await this.client.graph.search({
        query: query,
        userId: userId,
        limit: limit
      });

      // Filter by entity type if specified
      let results = searchResponse.edges || [];

      if (entityType) {
        results = results.filter((edge: any) =>
          edge.source?.entity_type === entityType || edge.target?.entity_type === entityType
        );
      }

      console.log(`📊 [ZepGraphService] Found ${results.length} entities matching query`);
      return results;

    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to search entities:', error);
      throw error;
    }
  }

  /**
   * Get entity mapping by ID
   */
  async getEntityMapping(entityType: string, entityId: string): Promise<EntityMapping | null> {
    return await this.mappingService.getMapping(entityType, entityId);
  }
}