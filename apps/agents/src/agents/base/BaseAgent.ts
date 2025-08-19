import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, AgentType, MemoryContext } from "../../types/agents.js";
import { SupabaseService } from "../../services/SupabaseService.js";
import { EmbeddingService } from "../../services/EmbeddingService.js";

export abstract class BaseAgent {
  protected model: ChatOpenAI;
  protected supabaseService: SupabaseService;
  protected embeddingService: EmbeddingService;
  protected agentType: AgentType;
  protected tools: any[] = [];

  constructor(agentType: AgentType, modelName: string = "gpt-4o-mini") {
    this.agentType = agentType;
    this.model = new ChatOpenAI({
      modelName,
      temperature: 0.1,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabaseService = new SupabaseService();
    this.embeddingService = new EmbeddingService();
  }

  // Abstract methods that each agent must implement
  abstract initialize(): Promise<void>;
  abstract processMessage(context: AgentContext, message: string): Promise<AgentResponse>;
  abstract getSystemPrompt(): string;
  abstract getCapabilities(): string[];

  // Shared utility methods
  protected async loadMemoryContext(context: AgentContext): Promise<MemoryContext> {
    // Load recent events for context
    const recentEvents = await this.supabaseService.getEvents(context.userId);
    const recentEventEmbeddings = recentEvents.slice(0, 10).map(event => ({
      content: `${event.event_title} - ${event.event_description || ''}`,
      embedding: event.embedding || [],
      timestamp: event.event_starts_at
    }));

    // Load recent chat messages
    const recentChats = context.conversationHistory.slice(-10).map(msg => ({
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      embedding: [], // TODO: Generate embeddings for chat messages
      timestamp: new Date().toISOString()
    }));

    // Convert ConversationMessage to BaseMessage format for memory
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
        entities: {}, // TODO: Implement entity extraction
        relationships: {}
      },
      vector: {
        recentEvents: recentEventEmbeddings,
        recentChats: recentChats,
        semanticContext: this.buildSemanticContext(recentEventEmbeddings, recentChats)
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