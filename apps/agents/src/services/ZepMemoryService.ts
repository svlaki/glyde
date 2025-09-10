import { ZepClient } from '@getzep/zep-cloud';
import type { 
  MemoryContext, 
  ConversationMemory, 
  UserProfileMemory, 
  EntityMemory, 
  VectorMemory,
  Goal 
} from '../types/agents.js';
import { BaseMessage } from '@langchain/core/messages';

export interface ZepUser {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, any>;
}

export interface ZepMessage {
  role: string;
  roleType: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

export interface CalendarEvent {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  participants?: string[];
  topics?: string[];
  location?: string;
  energyLevel?: 'low' | 'medium' | 'high';
}

export interface TaskCompletion {
  task: string;
  completedAt: Date;
  notes?: string;
  energyLevel?: 'low' | 'medium' | 'high';
  category?: string;
}

export interface GoalProgress {
  goalTitle: string;
  progress: number;
  notes?: string;
  milestones?: string[];
}

export class ZepMemoryService {
  private client: ZepClient;
  private userSessions: Map<string, string> = new Map();

  constructor() {
    const apiKey = process.env.ZEP_API_KEY;
    
    if (!apiKey) {
      throw new Error('ZEP_API_KEY environment variable is required');
    }

    this.client = new ZepClient({
      apiKey
    });
    
    console.log('ZepMemoryService initialized with API key');
  }

  /**
   * Initialize or ensure a user exists in Zep
   */
  async initUser(userId: string, userData?: Partial<ZepUser>): Promise<void> {
    try {
      // Check if user exists first
      try {
        await this.client.user.get(userId);
        console.log(`User ${userId} already exists`);
        return;
      } catch (error: any) {
        // User doesn't exist, create them
        if (error?.statusCode === 404 || error?.status === 404) {
          await this.client.user.add({
            userId,
            email: userData?.email,
            firstName: userData?.firstName,
            lastName: userData?.lastName,
            metadata: userData?.metadata || {}
          });
          console.log(`Created new user: ${userId}`);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Failed to initialize user:', error);
      throw error;
    }
  }

  /**
   * Get or create a session for a user
   */
  private async getOrCreateSession(userId: string): Promise<string> {
    const existingSessionId = this.userSessions.get(userId);
    if (existingSessionId) {
      return existingSessionId;
    }

    // Create new session ID
    const sessionId = `${userId}-session-${Date.now()}`;
    
    try {
      await this.client.memory.addSession({
        sessionId,
        userId,
        metadata: {
          created_at: new Date().toISOString(),
          type: 'conversation'
        }
      });

      this.userSessions.set(userId, sessionId);
      console.log(`Created new session: ${sessionId} for user ${userId}`);
      return sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Add a conversation exchange to memory
   */
  async addConversation(
    userId: string, 
    userMessage: string, 
    assistantResponse: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.initUser(userId);
      const sessionId = await this.getOrCreateSession(userId);

      // Add messages to Zep
      const messages: ZepMessage[] = [
        {
          role: 'user',
          roleType: 'user',
          content: userMessage,
          metadata: {
            timestamp: new Date().toISOString(),
            ...metadata
          }
        },
        {
          role: 'assistant',
          roleType: 'assistant',
          content: assistantResponse,
          metadata: {
            timestamp: new Date().toISOString(),
            ...metadata
          }
        }
      ];

      await this.client.memory.add(sessionId, {
        messages
      });

      console.log(`Added conversation to Zep session ${sessionId} for user ${userId}`);
    } catch (error) {
      console.error('Failed to add conversation:', error);
      throw error;
    }
  }

  /**
   * Add calendar event as structured business data
   */
  async addCalendarEvent(userId: string, event: CalendarEvent): Promise<void> {
    try {
      await this.initUser(userId);

      // Note: Using graph.add requires checking if it exists in the client
      // For now, we'll add it as a session fact
      const sessionId = await this.getOrCreateSession(userId);
      
      const eventData = {
        type: 'calendar_event',
        title: event.title,
        description: event.description,
        start_time: event.startTime.toISOString(),
        end_time: event.endTime?.toISOString(),
        location: event.location,
        participants: event.participants || [],
        topics: event.topics || [],
        energy_level: event.energyLevel,
        created_at: new Date().toISOString()
      };

      // Add as a conversation message instead of deprecated facts
      await this.client.memory.add(sessionId, {
        messages: [{
          role: 'system',
          roleType: 'system',
          content: `Calendar event: ${event.title} scheduled for ${event.startTime.toISOString()}. Location: ${event.location || 'Not specified'}. Participants: ${event.participants?.join(', ') || 'None'}`,
          metadata: {
            type: 'calendar_event',
            event_title: event.title,
            start_time: event.startTime.toISOString(),
            timestamp: new Date().toISOString()
          }
        }]
      });

      console.log(`Added calendar event "${event.title}" to Zep for user ${userId}`);
    } catch (error) {
      console.error('Failed to add calendar event:', error);
      throw error;
    }
  }

  /**
   * Add task completion as structured data
   */
  async addTaskCompletion(userId: string, task: TaskCompletion): Promise<void> {
    try {
      await this.initUser(userId);
      const sessionId = await this.getOrCreateSession(userId);

      // Add as a conversation message instead of deprecated facts
      const taskText = `Task completed: "${task.task}" on ${task.completedAt.toISOString()}${task.notes ? ` - ${task.notes}` : ''}`;
      
      await this.client.memory.add(sessionId, {
        messages: [{
          role: 'system',
          roleType: 'system',
          content: taskText,
          metadata: {
            type: 'task_completion',
            task_name: task.task,
            completed_at: task.completedAt.toISOString(),
            energy_level: task.energyLevel,
            category: task.category,
            timestamp: new Date().toISOString()
          }
        }]
      });

      console.log(`Added task completion "${task.task}" to Zep for user ${userId}`);
    } catch (error) {
      console.error('Failed to add task completion:', error);
      throw error;
    }
  }

  /**
   * Add goal progress as a fact
   */
  async addGoalProgress(userId: string, goalProgress: GoalProgress): Promise<void> {
    try {
      await this.initUser(userId);
      const sessionId = await this.getOrCreateSession(userId);

      const goalText = `Goal progress: "${goalProgress.goalTitle}" is ${goalProgress.progress}% complete${goalProgress.notes ? ` - ${goalProgress.notes}` : ''}`;
      
      await this.client.memory.add(sessionId, {
        messages: [{
          role: 'system',
          roleType: 'system',
          content: goalText,
          metadata: {
            type: 'goal_progress',
            goal_title: goalProgress.goalTitle,
            progress_percentage: goalProgress.progress,
            milestones: goalProgress.milestones,
            timestamp: new Date().toISOString()
          }
        }]
      });

      console.log(`Added goal progress for "${goalProgress.goalTitle}" to Zep for user ${userId}`);
    } catch (error) {
      console.error('Failed to add goal progress:', error);
      throw error;
    }
  }

  /**
   * Get user context from Zep (replaces old getMemoryContext)
   */
  async getUserContext(userId: string): Promise<string> {
    try {
      await this.initUser(userId);
      const sessionId = await this.getOrCreateSession(userId);

      const memory = await this.client.memory.get(sessionId);
      
      // Return combined context from facts and summaries
      const facts = memory.facts?.join('\n') || '';
      const summary = memory.summary?.content || '';
      
      return [facts, summary].filter(Boolean).join('\n\n');
    } catch (error) {
      console.error('Failed to get user context:', error);
      return '';
    }
  }

  /**
   * Search memory for relevant information
   */
  async searchMemory(userId: string, query: string, limit: number = 10): Promise<any[]> {
    try {
      await this.initUser(userId);
      const sessionId = await this.getOrCreateSession(userId);

      const results = await this.client.memory.search(sessionId, {
        text: query,
        metadata: {},
        limit
      });

      return results.map(result => ({
        content: result.message?.content || result.summary?.content || '',
        relevance: result.score || 1.0,
        timestamp: result.message?.createdAt || result.summary?.createdAt
      }));
    } catch (error) {
      console.error('Failed to search memory:', error);
      return [];
    }
  }

  /**
   * Get formatted memory context for agents (compatible with existing MemoryContext interface)
   */
  async getMemoryContext(userId: string): Promise<MemoryContext> {
    try {
      const contextString = await this.getUserContext(userId);
      const sessionId = this.userSessions.get(userId) || '';

      // Create a compatible memory context structure
      const memoryContext: MemoryContext = {
        shortTerm: {
          sessionId,
          messages: [], // Zep handles this internally
          context: contextString,
          summary: contextString.substring(0, 200), // Brief summary
          lastUpdated: new Date().toISOString()
        },
        longTerm: {
          userId,
          profile: {
            id: userId,
            email: '',
            timezone: '',
            preferences: {}
          },
          preferences: {},
          goals: [],
          insights: [],
          lastUpdated: new Date().toISOString()
        },
        entity: {
          entities: {},
          relationships: {}
        },
        vector: {
          recentEvents: [],
          recentChats: [],
          semanticContext: contextString
        }
      };

      return memoryContext;
    } catch (error) {
      console.error('Failed to get memory context:', error);
      // Return empty context structure on error
      return {
        shortTerm: {
          sessionId: '',
          messages: [],
          context: '',
          lastUpdated: new Date().toISOString()
        },
        longTerm: {
          userId,
          profile: {
            id: userId,
            email: '',
            timezone: '',
            preferences: {}
          },
          preferences: {},
          goals: [],
          insights: [],
          lastUpdated: new Date().toISOString()
        },
        entity: {
          entities: {},
          relationships: {}
        },
        vector: {
          recentEvents: [],
          recentChats: [],
          semanticContext: ''
        }
      };
    }
  }

  /**
   * Health check for the Zep service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to perform a simple operation to check if Zep is available
      const testUserId = 'health-check-test';
      await this.searchMemory(testUserId, 'test', 1);
      return true;
    } catch (error) {
      console.error('Zep health check failed:', error);
      return false;
    }
  }
}

export default ZepMemoryService;