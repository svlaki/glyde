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
  archetype?: string;
  archetypeData?: Record<string, any>;
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
    if (!process.env.ZEP_API_KEY) {
      throw new Error('ZEP_API_KEY environment variable is required');
    }

    this.client = new ZepClient({
      apiKey: process.env.ZEP_API_KEY,
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
            archetype: event.archetype || 'generic',
            archetypeData: event.archetypeData || {},
            energyLevel: event.energyLevel,
            participants: event.participants || [],
            topics: event.topics || [],
            createdAt: event.createdAt
          },
          content: this.generateEventContent(event)
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
          archetype: updates.archetype,
          archetypeData: updates.archetypeData,
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

  /**
   * Generate rich content for calendar events based on archetype
   */
  private generateEventContent(event: CalendarEventEntity): string {
    let content = `Calendar event: ${event.title} scheduled for ${event.startTime}`;

    if (event.location) {
      content += ` at ${event.location}`;
    }

    if (event.participants && event.participants.length > 0) {
      content += `. Participants: ${event.participants.join(', ')}`;
    }

    if (event.archetype && event.archetype !== 'generic' && event.archetypeData) {
      content += `. Event type: ${event.archetype}`;

      switch (event.archetype) {
        case 'grocery':
          if (event.archetypeData.shopping_list) {
            const items = event.archetypeData.shopping_list.map((item: any) => item.item || item).join(', ');
            content += `. Shopping for: ${items}`;
          }
          break;

        case 'meeting':
          if (event.archetypeData.agenda) {
            const topics = event.archetypeData.agenda.map((a: any) => a.topic || a).join(', ');
            content += `. Meeting topics: ${topics}`;
          }
          break;

        case 'workout':
          if (event.archetypeData.workout_type) {
            content += `. Workout: ${event.archetypeData.workout_type}`;
          }
          break;

        case 'appointment':
          if (event.archetypeData.provider_type) {
            content += `. Appointment with: ${event.archetypeData.provider_type}`;
          }
          break;
      }
    }

    if (event.energyLevel) {
      content += `. Energy level required: ${event.energyLevel}`;
    }

    return content;
  }

  /**
   * Health check for the graph service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple test to verify the client is working
      await this.client.graph.search({
        query: 'test',
        userId: 'health-check',
        limit: 1
      });
      return true;
    } catch (error) {
      console.error('❌ [ZepGraphService] Health check failed:', error);
      return false;
    }
  }

  /**
   * Clean up all entities for a user (use with caution)
   */
  async cleanupUserGraph(userId: string): Promise<void> {
    try {
      console.log(`🧹 [ZepGraphService] Cleaning up graph data for user ${userId}`);

      // Remove all mappings for this user
      const userMappings = await this.mappingService.getUserMappings(userId);

      for (const mapping of userMappings) {
        try {
          await this.client.graph.episode.delete(mapping.graphUuid);
          await this.mappingService.deleteMapping(mapping.entityType, mapping.entityId);
        } catch (error) {
          console.warn(`⚠️ [ZepGraphService] Failed to delete entity ${mapping.graphUuid}:`, error);
        }
      }

      console.log(`✅ [ZepGraphService] Cleaned up ${userMappings.length} entities for user ${userId}`);

    } catch (error) {
      console.error('❌ [ZepGraphService] Failed to cleanup user graph:', error);
      throw error;
    }
  }
}

export default ZepGraphService;