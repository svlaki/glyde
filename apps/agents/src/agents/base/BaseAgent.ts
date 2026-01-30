import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, AgentType, MemoryContext, MessageContent } from "../../types/agents.js";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepMemoryService } from "../../services/ZepMemoryService.js";
import { env } from "../../utils/env.js";

export abstract class BaseAgent {
  protected model: ChatOpenAI;
  protected supabaseService: SupabaseService;
  protected zepService: ZepMemoryService;
  protected agentType: AgentType;
  protected tools: any[] = [];

  constructor(agentType: AgentType, modelName: string = "gpt-5.1") {
    this.agentType = agentType;
    this.model = new ChatOpenAI({
      modelName,
      temperature: 0.1,
      apiKey: env.OPENAI_API_KEY,
    });
    this.supabaseService = new SupabaseService();
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
      // Use Zep's thread.getUserContext() API for memory context loading
      // sessionId is the threadId created during conversation
      const zepContext = await this.zepService.getMemoryContext(context.sessionId, context.userId);
      console.log(`Loaded memory context from Zep for thread ${context.sessionId}`);
      return zepContext;

    } catch (error) {
      console.warn('Failed to load memory context from Zep, falling back to basic context:', error);
      return this.loadBasicMemoryContext(context);
    }
  }

  // Helper to extract text from MessageContent (handles string or multipart array)
  private extractTextFromContent(content: MessageContent): string {
    if (typeof content === 'string') {
      return content;
    }
    // Extract text from content array (for multimodal messages)
    const textPart = content.find(part => part.type === 'text');
    return textPart && 'text' in textPart ? textPart.text : '';
  }

  // Fallback memory loading for when Zep is unavailable
  private async loadBasicMemoryContext(context: AgentContext): Promise<MemoryContext> {
    const recentEvents = await this.supabaseService.getEvents(context.userId);
    const recentEventSummaries = recentEvents.slice(0, 10).map(event => ({
      content: `${event.title} - ${event.description || ''}`,
      timestamp: event.start_time
    }));

    const baseMessages: BaseMessage[] = context.conversationHistory.map(msg => {
      const textContent = this.extractTextFromContent(msg.content);
      if (msg.role === 'user') {
        return new HumanMessage(textContent);
      } else if (msg.role === 'assistant') {
        return new AIMessage(textContent);
      } else {
        return new SystemMessage(textContent);
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
        recentEvents: recentEventSummaries,
        recentChats: [],
        semanticContext: this.buildSemanticContext(recentEventSummaries, [])
      }
    };
  }

  private buildConversationContext(messages: import('../../types/agents.js').ConversationMessage[]): string {
    const recentMessages = messages.slice(-5);
    return recentMessages.map(msg => `${msg.role}: ${this.extractTextFromContent(msg.content)}`).join('\n');
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
    // Note: Graph sync disabled to prevent Zep graph bloat
    // Task completion sync creates too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement periodic aggregation of task completions as patterns instead
    console.log(`Task completion tracked for user ${userId}: ${taskTitle}`);
  }

  protected async persistGoalProgressToMemory(
    userId: string,
    goalTitle: string,
    progressUpdate: string,
    currentProgress: number,
    moodRating?: number,
    confidenceLevel?: number
  ): Promise<void> {
    // Note: Graph sync disabled to prevent Zep graph bloat
    // Goal progress sync creates too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement periodic aggregation of goal progress as patterns instead
    console.log(`Goal progress tracked for user ${userId}: ${goalTitle} (${currentProgress}%)`);
  }

  protected async persistCalendarEventToMemory(
    userId: string,
    eventTitle: string,
    eventDescription: string | null,
    startTime: Date,
    endTime?: Date,
    attendees?: string[],
    location?: string,
    energy_level?: 'low' | 'medium' | 'high',
    category?: string
  ): Promise<void> {
    // Note: Graph sync disabled to prevent Zep graph bloat
    // Calendar event sync creates too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement periodic aggregation of calendar patterns instead
    console.log(`Calendar event tracked for user ${userId}: ${eventTitle} (${category || 'Personal'})`);
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