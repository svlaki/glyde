import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, AgentType, MemoryContext } from "../../types/agents.js";
import { SupabaseService } from "../../services/SupabaseService.js";
import { EmbeddingService } from "../../services/EmbeddingService.js";
import { GraphitiMemoryService } from "../../services/GraphitiMemoryService.js";

export abstract class BaseAgent {
  protected model: ChatOpenAI;
  protected supabaseService: SupabaseService;
  protected embeddingService: EmbeddingService;
  protected graphitiService: GraphitiMemoryService;
  protected agentType: AgentType;
  protected tools: any[] = [];
  protected userNodeCache: Map<string, string> = new Map(); // Cache user node UUIDs

  constructor(agentType: AgentType, modelName: string = "gpt-4o-mini") {
    this.agentType = agentType;
    this.model = new ChatOpenAI({
      modelName,
      temperature: 0.1,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabaseService = new SupabaseService();
    this.embeddingService = new EmbeddingService();
    this.graphitiService = new GraphitiMemoryService();
  }

  // Abstract methods that each agent must implement
  abstract initialize(): Promise<void>;
  abstract processMessage(context: AgentContext, message: string): Promise<AgentResponse>;
  abstract getSystemPrompt(): string;
  abstract getCapabilities(): string[];

  // Shared utility methods using Graphiti for memory
  protected async loadMemoryContext(context: AgentContext, contextType: 'conversation' | 'task_planning' | 'goal_coaching' = 'conversation'): Promise<MemoryContext> {
    try {
      // Get or cache user node UUID
      let userNodeUuid = this.userNodeCache.get(context.userId);
      if (!userNodeUuid) {
        const userNode = await this.graphitiService.ensureUserNode(context.userId);
        userNodeUuid = userNode.user_node_uuid;
        this.userNodeCache.set(context.userId, userNodeUuid);
      }

      // Get contextual memory from Graphiti
      const memoryContext = await this.graphitiService.getMemoryContext(
        context.userId,
        contextType,
        undefined, // Let Graphiti generate context-appropriate query
        15 // Get more facts for richer context
      );

      // Load recent events for immediate context (still useful for current session)
      const recentEvents = await this.supabaseService.getEvents(context.userId);
      const recentEventEmbeddings = recentEvents.slice(0, 5).map(event => ({
        content: `${event.event_title} - ${event.event_description || ''}`,
        embedding: event.embedding || [],
        timestamp: event.event_starts_at
      }));

      // Convert conversation history to BaseMessage format
      const baseMessages: BaseMessage[] = context.conversationHistory.map(msg => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        } else {
          return new SystemMessage(msg.content);
        }
      });

      // Build rich context from Graphiti facts
      const graphitiContext = memoryContext.facts.map(fact => fact.fact).join('\n- ');

      return {
        shortTerm: {
          sessionId: context.sessionId,
          messages: baseMessages,
          context: this.buildConversationContext(context.conversationHistory),
          lastUpdated: new Date().toISOString()
        },
        longTerm: {
          userId: context.userId,
          profile: context.userProfile || {
            id: context.userId,
            email: '',
            preferences: {},
            goals: [],
            insights: []
          },
          preferences: context.userProfile?.preferences || {},
          goals: context.userProfile?.goals || [],
          insights: context.userProfile?.insights || [],
          lastUpdated: new Date().toISOString()
        },
        entity: {
          entities: {
            userNode: {
              id: userNodeUuid,
              type: 'person' as const,
              name: context.userId,
              attributes: { graphitiNodeUuid: userNodeUuid },
              lastMentioned: new Date().toISOString(),
              importance: 1.0
            }
          },
          relationships: {} // Could be expanded with more graph relationships
        },
        vector: {
          recentEvents: recentEventEmbeddings,
          recentChats: [], // Now handled by Graphiti
          semanticContext: graphitiContext
        },
        // New Graphiti-specific context
        graphiti: {
          userNodeUuid,
          contextType,
          totalFacts: memoryContext.total_facts,
          relevantFacts: memoryContext.facts
        }
      };
    } catch (error) {
      console.warn('Failed to load Graphiti memory context, falling back to basic context:', error);
      
      // Fallback to basic context if Graphiti fails
      return this.loadBasicMemoryContext(context);
    }
  }

  // Fallback memory loading for when Graphiti is unavailable
  private async loadBasicMemoryContext(context: AgentContext): Promise<MemoryContext> {
    const recentEvents = await this.supabaseService.getEvents(context.userId);
    const recentEventEmbeddings = recentEvents.slice(0, 10).map(event => ({
      content: `${event.event_title} - ${event.event_description || ''}`,
      embedding: event.embedding || [],
      timestamp: event.event_starts_at
    }));

    const baseMessages: BaseMessage[] = context.conversationHistory.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else {
        return new SystemMessage(msg.content);
      }
    });

    return {
      shortTerm: {
        sessionId: context.sessionId,
        messages: baseMessages,
        context: this.buildConversationContext(context.conversationHistory),
        lastUpdated: new Date().toISOString()
      },
      longTerm: {
        userId: context.userId,
        profile: context.userProfile || {
          id: context.userId,
          email: '',
          preferences: {},
          goals: [],
          insights: []
        },
        preferences: context.userProfile?.preferences || {},
        goals: context.userProfile?.goals || [],
        insights: context.userProfile?.insights || [],
        lastUpdated: new Date().toISOString()
      },
      entity: {
        entities: {},
        relationships: {}
      },
      vector: {
        recentEvents: recentEventEmbeddings,
        recentChats: [],
        semanticContext: this.buildSemanticContext(recentEventEmbeddings, [])
      }
    };
  }

  private buildConversationContext(messages: import('../../types/agents.js').ConversationMessage[]): string {
    const recentMessages = messages.slice(-5);
    return recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }

  private buildSemanticContext(events: any[], chats: any[]): string {
    const eventContext = events.map(e => e.content).join(' ');
    const chatContext = chats.map(c => c.content).join(' ');
    return `Recent events: ${eventContext}\nRecent conversations: ${chatContext}`;
  }

  protected registerTools(tools: any[]): void {
    this.tools = tools;
  }

  protected async invokeWithTools(messages: BaseMessage[], context: AgentContext): Promise<any> {
    if (this.tools.length === 0) {
      return await this.model.invoke(messages);
    }

    const modelWithTools = this.model.bindTools(this.tools);
    return await modelWithTools.invoke(messages, {
      configurable: {
        userId: context.userId,
        sessionId: context.sessionId
      }
    });
  }

  // Graphiti memory persistence methods
  protected async persistConversationToMemory(
    context: AgentContext, 
    userMessage: string, 
    assistantResponse: string
  ): Promise<void> {
    try {
      await this.graphitiService.addConversationEpisode(
        context.userId,
        userMessage,
        assistantResponse,
        context.sessionId
      );
    } catch (error) {
      console.warn('Failed to persist conversation to Graphiti:', error);
    }
  }

  protected async persistTaskCompletionToMemory(
    userId: string,
    taskTitle: string,
    taskDescription: string | null,
    completionTime: Date,
    energyUsed?: 'low' | 'medium' | 'high',
    actualDuration?: number,
    completionNotes?: string
  ): Promise<void> {
    try {
      await this.graphitiService.addTaskCompletionEpisode(
        userId,
        taskTitle,
        taskDescription,
        completionTime,
        energyUsed,
        actualDuration,
        completionNotes
      );
    } catch (error) {
      console.warn('Failed to persist task completion to Graphiti:', error);
    }
  }

  protected async persistGoalProgressToMemory(
    userId: string,
    goalTitle: string,
    progressUpdate: string,
    currentProgress: number,
    moodRating?: number,
    confidenceLevel?: number
  ): Promise<void> {
    try {
      await this.graphitiService.addGoalProgressEpisode(
        userId,
        goalTitle,
        progressUpdate,
        currentProgress,
        moodRating,
        confidenceLevel
      );
    } catch (error) {
      console.warn('Failed to persist goal progress to Graphiti:', error);
    }
  }

  protected async persistCalendarEventToMemory(
    userId: string,
    eventTitle: string,
    eventDescription: string | null,
    startTime: Date,
    endTime: Date,
    location?: string | null,
    archetype?: string
  ): Promise<void> {
    try {
      await this.graphitiService.addCalendarEventEpisode(
        userId,
        eventTitle,
        eventDescription,
        startTime,
        endTime,
        location,
        archetype
      );
    } catch (error) {
      console.warn('Failed to persist calendar event to Graphiti:', error);
    }
  }

  // Utility method for other agents to call this agent
  async delegate(context: AgentContext, message: string): Promise<AgentResponse> {
    return await this.processMessage(context, message);
  }

  // Get basic info about this agent
  getInfo(): { type: AgentType; capabilities: string[] } {
    return {
      type: this.agentType,
      capabilities: this.getCapabilities()
    };
  }
}