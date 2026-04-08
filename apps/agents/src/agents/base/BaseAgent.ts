import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, AgentType, MemoryContext, MessageContent } from "../../types/agents.js";
import { SupabaseService, getSupabaseClient } from "../../services/SupabaseService.js";
import { MemoryService } from "../../services/MemoryService.js";
import { env } from "../../utils/env.js";

export abstract class BaseAgent {
  protected model: ChatOpenAI;
  protected modelName: string;
  protected supabaseService: SupabaseService;
  protected memoryService: MemoryService;
  protected agentType: AgentType;
  protected tools: any[] = [];

  constructor(agentType: AgentType, modelName: string = "gpt-5.4-mini") {
    this.agentType = agentType;
    this.modelName = modelName;
    this.model = new ChatOpenAI({
      modelName,
      temperature: 0.1,
      apiKey: env.OPENAI_API_KEY,
      streamUsage: true,
    });
    this.supabaseService = new SupabaseService();
    this.memoryService = MemoryService.getInstance();
  }

  // Abstract methods that each agent must implement
  abstract initialize(): Promise<void>;
  abstract processMessage(context: AgentContext, message: string): Promise<AgentResponse>;
  abstract getSystemPrompt(): string;
  abstract getCapabilities(): string[];

  // Shared utility methods for memory
  protected async loadMemoryContext(context: AgentContext, contextType: 'conversation' | 'task_planning' | 'goal_coaching' = 'conversation'): Promise<MemoryContext> {
    try {
      const contextString = await this.memoryService.getUserContext(context.userId);
      console.log(`Loaded memory context for user ${context.userId} (${contextString.length} chars)`);

      return {
        shortTerm: {
          sessionId: context.sessionId,
          messages: [],
          context: contextString,
          summary: contextString.substring(0, 200),
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
        entity: { entities: {}, relationships: {} },
        vector: { recentEvents: [], recentChats: [], semanticContext: contextString }
      };
    } catch (error) {
      console.warn('Failed to load memory context, falling back to basic context:', error);
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

  /**
   * Track token usage from LangGraph result messages.
   * Extracts usage_metadata from AI messages and logs to agent_token_usage table.
   * Fire-and-forget -- never blocks the response.
   */
  protected trackTokenUsage(
    userId: string,
    sessionId: string,
    messages: BaseMessage[],
    toolsUsed?: string[],
    processingTimeMs?: number,
  ): void {
    try {
      const aiMessages = messages.filter(m => 'usage_metadata' in m || 'response_metadata' in m);
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let cachedTokens = 0;
      let modelCallCount = 0;

      for (const msg of aiMessages) {
        const usage = (msg as any)?.usage_metadata || (msg as any)?.response_metadata?.tokenUsage;
        if (usage) {
          totalInputTokens += usage.input_tokens ?? usage.promptTokens ?? 0;
          totalOutputTokens += usage.output_tokens ?? usage.completionTokens ?? 0;
          cachedTokens += usage.cache_read_input_tokens ?? usage.cachedTokens ?? 0;
          modelCallCount++;
        }
      }

      if (totalInputTokens > 0 || totalOutputTokens > 0) {
        console.log(`[TOKEN TRACKING] ${this.agentType}: ${modelCallCount} calls, input=${totalInputTokens}, output=${totalOutputTokens}, cached=${cachedTokens}`);
        Promise.resolve(
          getSupabaseClient()
            .from('agent_token_usage')
            .insert({
              user_id: userId,
              session_id: sessionId,
              model_name: this.modelName,
              input_tokens: totalInputTokens,
              output_tokens: totalOutputTokens,
              total_tokens: totalInputTokens + totalOutputTokens,
              cached_tokens: cachedTokens,
              model_calls: modelCallCount,
              tools_used: toolsUsed || [],
              processing_time_ms: processingTimeMs || 0,
            })
        )
          .then(() => console.log(`[TOKEN TRACKING] Recorded ${totalInputTokens + totalOutputTokens} tokens (${this.agentType}) for user ${userId}`))
          .catch((err: any) => console.warn(`[TOKEN TRACKING] Failed to record (${this.agentType}):`, err));
      }
    } catch (err) {
      console.warn(`[TOKEN TRACKING] Error extracting usage (${this.agentType}):`, err);
    }
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

  // Memory persistence methods
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
      await this.memoryService.persistConversation(
        context.userId,
        userMessage,
        assistantResponse
      );
      console.log(`Persisted conversation to memory for user ${context.userId}`);
    } catch (error) {
      console.error('Failed to persist conversation to memory:', error);
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