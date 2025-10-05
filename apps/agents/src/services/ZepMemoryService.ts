/**
 * ZepMemoryService - Manages conversation threads and chat memory
 *
 * RESPONSIBILITIES:
 * - Thread/conversation management (create, add messages, search)
 * - User context from conversational history
 * - Message-based memory operations
 *
 * DOES NOT HANDLE:
 * - Structured entities (calendar events, tasks, goals) - use ZepGraphService
 * - Knowledge graph operations - use ZepGraphService
 * - Entity lifecycle management - use ZepGraphService
 */
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
import { env } from '../utils/env.js';

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

// REMOVED: Use CalendarEventEntity from ZepGraphService instead

// REMOVED: Use TaskEntity and GoalEntity from ZepGraphService instead

export class ZepMemoryService {
  private client: ZepClient;
  private userSessions: Map<string, string> = new Map();

  constructor() {
    const apiKey = env.ZEP_API_KEY;
    
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
   * Get or create a thread for a user
   */
  private async getOrCreateSession(userId: string): Promise<string> {
    const existingThreadId = this.userSessions.get(userId);
    if (existingThreadId) {
      return existingThreadId;
    }

    // Create new thread ID
    const threadId = `thread-${userId}-${Date.now()}`;

    try {
      await this.client.thread.create({
        threadId: threadId,
        userId: userId
      });

      this.userSessions.set(userId, threadId);
      console.log(`Created new thread: ${threadId} for user ${userId}`);
      return threadId;
    } catch (error) {
      console.error('Failed to create thread:', error);
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

      // Add messages to thread using correct API
      await this.client.thread.addMessages(sessionId, {
        messages: messages.map(msg => ({
          content: msg.content,
          role: msg.role as any, // Cast to satisfy RoleType requirement
          metadata: msg.metadata
        }))
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
  async addCalendarEvent(userId: string, event: any): Promise<void> {
    // REMOVED: Calendar events are now handled by ZepGraphService
    throw new Error('addCalendarEvent is deprecated. Use ZepGraphService.addCalendarEvent() instead.');
  }

  /**
   * Add task completion as structured data
   */
  async addTaskCompletion(userId: string, task: any): Promise<void> {
    // REMOVED: Task completions are now handled by ZepGraphService
    throw new Error('addTaskCompletion is deprecated. Use ZepGraphService.addTask() instead.');
  }

  /**
   * Add goal progress as a fact
   */
  async addGoalProgress(userId: string, goalProgress: any): Promise<void> {
    // REMOVED: Goal progress is now handled by ZepGraphService
    throw new Error('addGoalProgress is deprecated. Use ZepGraphService.addGoal() instead.');
  }

  /**
   * Get user context from Zep (replaces old getMemoryContext)
   */
  async getUserContext(userId: string): Promise<string> {
    // Graphiti disabled - skip user context retrieval
    console.log(`⏭️  [ZepMemoryService] Graphiti disabled - skipping user context for ${userId}`);
    return '';
  }

  /**
   * Search memory for relevant conversational information
   * Note: For structured entity search, use ZepGraphService.searchEntities() instead
   */
  async searchMemory(userId: string, query: string, limit: number = 10): Promise<any[]> {
    try {
      await this.initUser(userId);

      // For now, use graph search for memory content since the thread search API
      // may have different patterns in v3.x. This should be revisited.
      const searchResponse = await this.client.graph.search({
        query: query,
        userId: userId,
        limit: limit
      });

      // Filter for conversation-related content from episodes
      const episodes = searchResponse.episodes || [];
      const results = episodes
        .filter((episode: any) =>
          episode.content?.includes('conversation') ||
          episode.content?.includes('message') ||
          episode.metadata?.type === 'conversation'
        )
        .map((episode: any) => ({
          content: episode.content || '',
          relevance: 1.0, // Episodes don't have scores directly
          timestamp: episode.createdAt || new Date().toISOString()
        }));

      return results;
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