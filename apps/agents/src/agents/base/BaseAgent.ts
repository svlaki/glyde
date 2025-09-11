import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, AgentType, MemoryContext } from "../../types/agents.js";
import { SupabaseService } from "../../services/SupabaseService.js";
import { EmbeddingService } from "../../services/EmbeddingService.js";
import { ZepMemoryService } from "../../services/ZepMemoryService.js";

export abstract class BaseAgent {
  protected model: ChatOpenAI;
  protected supabaseService: SupabaseService;
  protected embeddingService: EmbeddingService;
  protected zepService: ZepMemoryService;
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
    this.zepService = new ZepMemoryService();
  }

  // Abstract methods that each agent must implement
  abstract initialize(): Promise<void>;
  abstract processMessage(context: AgentContext, message: string): Promise<AgentResponse>;
  abstract getSystemPrompt(): string;
  abstract getCapabilities(): string[];

  // Shared utility methods using Zep for memory
  protected async loadMemoryContext(context: AgentContext, contextType: 'conversation' | 'task_planning' | 'goal_coaching' = 'conversation'): Promise<MemoryContext> {
    try {
      // Use Zep for memory context loading
      const zepContext = await this.zepService.getMemoryContext(context.userId);
      console.log(`Loaded memory context from Zep for user ${context.userId}`);
      return zepContext;
      
    } catch (error) {
      console.warn('Failed to load memory context from Zep, falling back to basic context:', error);
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
    // Skip persistence for internal messages
    if (context.isInternal) {
      console.log(`Skipping persistence for internal message from user ${context.userId}`);
      return;
    }
    
    try {
      await this.zepService.addConversation(
        context.userId,
        userMessage,
        assistantResponse,
        {
          agentType: this.agentType,
          timestamp: new Date().toISOString()
        }
      );
      console.log(`Persisted conversation to Zep for user ${context.userId}`);
    } catch (error) {
      console.error('Failed to persist conversation to Zep:', error);
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
      await this.zepService.addTaskCompletion(userId, {
        task: taskTitle,
        completedAt: completionTime,
        notes: taskDescription || completionNotes,
        energyLevel: energyUsed,
        category: 'task_completion'
      });
      console.log(`Persisted task completion to Zep for user ${userId}: ${taskTitle}`);
    } catch (error) {
      console.error('Failed to persist task completion to Zep:', error);
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
      await this.zepService.addGoalProgress(userId, {
        goalTitle,
        progress: currentProgress,
        notes: progressUpdate,
        milestones: moodRating ? [`Mood: ${moodRating}/10`] : undefined
      });
      console.log(`Persisted goal progress to Zep for user ${userId}: ${goalTitle} (${currentProgress}%)`);
    } catch (error) {
      console.error('Failed to persist goal progress to Zep:', error);
    }
  }

  protected async persistCalendarEventToMemory(
    userId: string,
    eventTitle: string,
    eventDescription: string | null,
    startTime: Date,
    endTime?: Date,
    attendees?: string[],
    location?: string,
    energy_level?: 'low' | 'medium' | 'high'
  ): Promise<void> {
    try {
      await this.zepService.addCalendarEvent(userId, {
        title: eventTitle,
        description: eventDescription || undefined,
        startTime,
        endTime,
        participants: attendees,
        location,
        energyLevel: energy_level
      });
      console.log(`Persisted calendar event to Zep for user ${userId}: ${eventTitle}`);
    } catch (error) {
      console.error('Failed to persist calendar event to Zep:', error);
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