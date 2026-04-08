import { StateGraph, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SupabaseService, getSupabaseClient } from '../../services/SupabaseService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse, ImageContent } from '../../types/agents.js';
import { getCurrentTimeInTimezone, isValidTimezone } from '../../utils/timezoneUtils.js';
import { toDate, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { buildOnboardingSystemPrompt } from './prompts.js';

const OnboardingState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
  userId: Annotation<string>(),
  timezone: Annotation<string>(),
  userEvents: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userTasks: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userGoals: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userAspects: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userProfile: Annotation<any>({
    reducer: (_existing, update) => update || _existing,
    default: () => null,
  }),
  messageCount: Annotation<number>({
    reducer: (_existing, update) => update || _existing,
    default: () => 0,
  }),
});

type OnboardingStateType = typeof OnboardingState.State;

const CONTINUATION_PROMPT = `You are Glyde, setting up a new user. You just executed tools. Continue the onboarding conversation.
Keep it short (2-3 sentences). Ask about the next life area you haven't covered yet.
Do NOT use markdown. Do NOT give advice. Do NOT narrate what you just did.
If you still need to call more tools for what the user just told you, call them now before responding.`;

export class OnboardingEnrichmentAgent extends BaseAgent {
  private graph: any;

  constructor() {
    super('onboarding', 'gpt-5.4-mini');
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    console.log('[ONBOARDING AGENT] Initialized');
  }

  getSystemPrompt(): string {
    return 'Onboarding enrichment agent';
  }

  getCapabilities(): string[] {
    return ['onboarding-enrichment', 'aspect-creation', 'goal-creation', 'event-scheduling', 'profile-update'];
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    const result = await this.graph.invoke({
      messages: [new HumanMessage(message)],
      userId: context.userId,
      timezone: context.timezone || 'UTC',
    });

    // Track token usage
    this.trackTokenUsage(context.userId, context.sessionId || `onboarding-${Date.now()}`, result.messages);

    const lastMessage = result.messages[result.messages.length - 1];
    return {
      content: typeof lastMessage.content === 'string' ? lastMessage.content : '',
      type: 'text',
    };
  }

  async *streamMessage(context: AgentContext, message: string, images: ImageContent[] = []): AsyncGenerator<{
    type: 'text-delta' | 'tool-start' | 'tool-end' | 'error' | 'status';
    content?: string;
    toolName?: string;
    toolResult?: any;
  }> {
    try {
      yield { type: 'status', content: 'Setting up your profile...' };

      const supabaseService = new SupabaseService();

      const [userProfile, allEvents, allTasks, allGoals, userAspects] = await Promise.all([
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
      ]);

      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';
      if (!isValidTimezone(userTimezone)) {
        userTimezone = 'UTC';
      }

      // Build conversation history
      const messages: BaseMessage[] = [];
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory.slice(-14);
        for (const msg of recentHistory) {
          if (msg.role === 'user') {
            messages.push(new HumanMessage(typeof msg.content === 'string' ? msg.content : ''));
          } else if (msg.role === 'assistant') {
            const text = typeof msg.content === 'string' ? msg.content : '';
            const truncated = text.length > 800 ? text.slice(0, 800) + '...' : text;
            messages.push(new AIMessage(truncated));
          }
        }
      }

      // Add current message
      messages.push(new HumanMessage(message));

      const messageCount = context.conversationHistory?.filter(m => m.role === 'user').length || 0;

      // Limit events/tasks/goals
      const now = new Date();
      const futureEvents = allEvents
        .filter((e: any) => new Date(e.end_time) >= now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 15);
      const userTasks = allTasks.slice(0, 10);
      const userGoals = allGoals.slice(0, 8);

      const initialState = {
        messages,
        userId: context.userId,
        timezone: userTimezone,
        userEvents: futureEvents,
        userTasks,
        userGoals,
        userAspects: userAspects || [],
        userProfile: userProfile || null,
        messageCount,
      };

      yield { type: 'status', content: 'Thinking...' };

      const eventStream = this.graph.streamEvents(initialState, { version: 'v2' });

      let fullResponse = '';
      let streamInputTokens = 0;
      let streamOutputTokens = 0;
      let modelCallCount = 0;
      const toolsUsed: string[] = [];
      const streamStartTime = Date.now();

      for await (const event of eventStream) {
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data?.chunk;
          if (chunk && chunk.content && typeof chunk.content === 'string') {
            fullResponse += chunk.content;
            yield { type: 'text-delta', content: chunk.content };
          }
        } else if (event.event === 'on_chat_model_end') {
          modelCallCount++;
          const output = event.data?.output;
          if (output?.usage_metadata) {
            streamInputTokens += output.usage_metadata.input_tokens || 0;
            streamOutputTokens += output.usage_metadata.output_tokens || 0;
          }
        } else if (event.event === 'on_tool_start') {
          console.log(`[ONBOARDING] Tool starting: ${event.name}`);
          yield { type: 'tool-start', toolName: event.name };
          if (event.name && !toolsUsed.includes(event.name)) {
            toolsUsed.push(event.name);
          }
        } else if (event.event === 'on_tool_end') {
          console.log(`[ONBOARDING] Tool completed: ${event.name}`);
          yield { type: 'tool-end', toolName: event.name, toolResult: event.data?.output };
        }
      }

      // Track token usage
      console.log(`[ONBOARDING] Stream complete. ${modelCallCount} model calls. Input: ${streamInputTokens}, Output: ${streamOutputTokens}, Tools: [${toolsUsed.join(', ')}]`);
      if (streamInputTokens > 0 || streamOutputTokens > 0) {
        Promise.resolve(
          getSupabaseClient()
            .from('agent_token_usage')
            .insert({
              user_id: context.userId,
              session_id: context.sessionId,
              model_name: this.modelName,
              input_tokens: streamInputTokens,
              output_tokens: streamOutputTokens,
              total_tokens: streamInputTokens + streamOutputTokens,
              model_calls: modelCallCount,
              tools_used: toolsUsed,
              processing_time_ms: Date.now() - streamStartTime,
            })
        ).catch((err: any) => console.warn('[ONBOARDING] Token tracking failed:', err));
      }

      // Persist to memory
      try {
        await this.persistConversationToMemory(context, message, fullResponse);
      } catch (error) {
        console.warn('[ONBOARDING] Memory persistence failed:', error);
      }

    } catch (error) {
      console.error('[ONBOARDING] Stream error:', error);
      yield { type: 'error', content: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private formatEventContext(events: any[], timezone: string): string {
    if (events.length === 0) return '\nCALENDAR: No events yet';
    const lines = events.map(e => {
      const startDate = toDate(e.start_time);
      const endDate = toDate(e.end_time);
      const dateStr = formatInTimeZone(startDate, timezone, 'EEE M/d');
      const startTime = formatInTimeZone(startDate, timezone, 'h:mma').toLowerCase();
      const endTime = formatInTimeZone(endDate, timezone, 'h:mma').toLowerCase();
      const aspect = e.aspect ? ` [${e.aspect}]` : '';
      return `  ${e.title} ${dateStr} ${startTime}-${endTime}${aspect}`;
    });
    return `\nCALENDAR (${events.length}):\n${lines.join('\n')}`;
  }

  private formatTaskContext(tasks: any[]): string {
    if (tasks.length === 0) return '\nTASKS: None';
    const lines = tasks.map(t => `  ${t.title}${t.priority ? ` [${t.priority}]` : ''}${t.aspect ? ` {${t.aspect}}` : ''}`);
    return `\nTASKS (${tasks.length}):\n${lines.join('\n')}`;
  }

  private formatGoalContext(goals: any[]): string {
    if (goals.length === 0) return '\nGOALS: None';
    const lines = goals.map(g => `  ${g.title}${g.aspect ? ` (${g.aspect})` : ''}`);
    return `\nGOALS (${goals.length}):\n${lines.join('\n')}`;
  }

  private createGraph(): any {
    const toolRegistry = ToolRegistry.getInstance();
    const allTools = toolRegistry.getOnboardingAgentTools();
    const toolNode = new ToolNode(allTools);

    this.registerTools(allTools);
    console.log(`[ONBOARDING AGENT] Loaded ${allTools.length} tools`);

    // Wrap ToolNode to match state graph types
    const executeTools = async (state: OnboardingStateType) => {
      const result = await toolNode.invoke(state.messages, {
        configurable: { userId: state.userId, timezone: state.timezone },
      });
      const toolMessages = Array.isArray(result) ? result : [result];
      console.log(`[ONBOARDING] Tool execution completed`);
      return { messages: toolMessages };
    };

    const callModel = async (state: OnboardingStateType) => {
      const lastMsg = state.messages[state.messages.length - 1];
      const isToolReEntry = lastMsg && lastMsg._getType() === 'tool';

      const msgCount = state.messages.filter(m => m._getType() === 'human').length;
      console.log(`[ONBOARDING] ${isToolReEntry ? 'Tool re-entry' : 'Full mode'}: ${state.messages.length} messages (${allTools.length} tools)`);

      let systemPrompt;
      if (isToolReEntry) {
        systemPrompt = CONTINUATION_PROMPT;
      } else {
        const timezone = state.timezone || 'UTC';
        const now = new Date();
        const today = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
        const tomorrow = formatInTimeZone(addDays(now, 1), timezone, 'yyyy-MM-dd');
        const tomorrowDay = formatInTimeZone(addDays(now, 1), timezone, 'EEEE');

        systemPrompt = buildOnboardingSystemPrompt({
          timezone,
          todayFormatted: today,
          tomorrowFormatted: tomorrow,
          tomorrowDayName: tomorrowDay,
          eventContext: this.formatEventContext(state.userEvents, timezone),
          taskContext: this.formatTaskContext(state.userTasks),
          goalContext: this.formatGoalContext(state.userGoals),
          userAspects: state.userAspects,
          userProfile: state.userProfile,
          messageCount: state.messageCount || msgCount,
          toolCount: allTools.length,
        }).content as string;
      }

      const modelWithTools = this.model.bindTools(allTools);
      const response = await modelWithTools.invoke(
        [{ role: 'system', content: systemPrompt }, ...state.messages],
        {
          configurable: {
            userId: state.userId,
            timezone: state.timezone,
          },
        }
      );

      const toolCalls = (response as any).tool_calls || [];
      console.log(`[ONBOARDING] Response: ${toolCalls.length} tool_calls${toolCalls.length > 0 ? `: ${toolCalls.map((tc: any) => tc.name).join(', ')}` : ''}`);

      return { messages: [response] };
    };

    const shouldContinue = (state: OnboardingStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const toolCalls = (lastMessage as any)?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        return 'tools';
      }
      return '__end__';
    };

    const workflow = new StateGraph(OnboardingState)
      .addNode('agent', callModel)
      .addNode('tools', executeTools)
      .addEdge('__start__', 'agent')
      .addConditionalEdges('agent', shouldContinue, { tools: 'tools', __end__: '__end__' })
      .addEdge('tools', 'agent');

    return workflow.compile();
  }
}
