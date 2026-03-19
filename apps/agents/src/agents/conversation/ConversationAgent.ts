import { StateGraph, Annotation } from "@langchain/langgraph";
// ChatOpenAI is imported by BaseAgent
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService, ActivityLogEntry, getSupabaseClient } from '../../services/SupabaseService.js';
import projectService from '../../services/ProjectService.js';
import ruleService from '../../services/RuleService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse, ImageContent } from '../../types/agents.js';
import { getCurrentTimeInTimezone, isValidTimezone } from '../../utils/timezoneUtils.js';
import { toDate, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { reverseGeocode } from '../../tools/search/location-search.js';
import { buildSystemPrompt, buildSummaryContext } from './prompts.js';
import { DatabaseProfile, DatabaseAspect } from '../../types/database.js';
import { FriendshipService } from '../../services/FriendshipService.js';
import { ContextRouter, RoutingDecision } from './ContextRouter.js';

// Define the state structure for our conversation agent
const ConversationState = Annotation.Root({
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
  userProjects: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userProfile: Annotation<DatabaseProfile | null>({
    reducer: (_existing, update) => update ?? _existing,
    default: () => null,
  }),
  recentUserActivity: Annotation<ActivityLogEntry[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  recentAgentActivity: Annotation<ActivityLogEntry[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  currentPage: Annotation<string>({
    reducer: (_existing, update) => update || _existing,
    default: () => 'dashboard',
  }),
  currentLocation: Annotation<{ latitude: number; longitude: number } | null>({
    reducer: (_existing, update) => update ?? _existing,
    default: () => null,
  }),
  currentAddress: Annotation<string | null>({
    reducer: (_existing, update) => update ?? _existing,
    default: () => null,
  }),
  ratingSummary: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  userFriends: Annotation<any[]>({
    reducer: (_existing, update) => update || _existing,
    default: () => [],
  }),
  routingDecision: Annotation<RoutingDecision | null>({
    reducer: (_existing, update) => update ?? _existing,
    default: () => null,
  }),
  zepContext: Annotation<string>({
    reducer: (_existing, update) => update || _existing,
    default: () => '',
  }),
  rulesContext: Annotation<string>({
    reducer: (_existing, update) => update || _existing,
    default: () => '',
  }),
});

type ConversationStateType = typeof ConversationState.State;

export class ConversationAgent extends BaseAgent {
  private graph: any;
  private contextRouter: ContextRouter;

  constructor() {
    super('conversation', "gpt-5.1"); // Use GPT-5.1 for best intelligence
    this.contextRouter = new ContextRouter();
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      // Step 1: Route the message to determine what context/tools are needed
      const recentMsgs = context.conversationHistory?.slice(-2).map(m =>
        typeof m.content === 'string' ? m.content : ''
      );
      const routingDecision = await this.contextRouter.route(message, recentMsgs);
      console.log(`[ROUTER] needs_tools=${routingDecision.needs_tools} tools=[${routingDecision.tools?.join(', ') || ''}] mode=${routingDecision.context_mode} | Categories: [${routingDecision.tool_categories.join(', ')}] | Prompts: [${routingDecision.prompt_sections.join(', ')}]`);

      // Load memory context using Graphiti
      const memoryContext = await this.loadMemoryContext(context, 'conversation');

      // Pre-load user data for LangGraph context
      const supabaseService = new SupabaseService();

      // Conditional data fetching based on routing decision
      const ctx = routingDecision.context_sections;

      const reverseGeocodePromise = context.location
        ? reverseGeocode(context.location.latitude, context.location.longitude).catch(() => null)
        : Promise.resolve(null);

      const friendshipService = new FriendshipService(supabaseService.getClient());

      // Always fetch: profile, events, tasks, goals, aspects (core data)
      // Conditionally fetch: projects, activity, ratings, friends
      const [userProfile, allEvents, allTasks, allGoals, userAspects, ...conditionalResults] = await Promise.all([
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
        // Conditional fetches — return null/[] if not needed
        ctx.projects ? projectService.getProjects(context.userId) : Promise.resolve([]),
        ctx.activity_logs ? supabaseService.getRecentActivity(context.userId, 'user', 30, 20) : Promise.resolve([]),
        ctx.activity_logs ? supabaseService.getRecentActivity(context.userId, 'agent', 60, 5) : Promise.resolve([]),
        reverseGeocodePromise,
        ctx.ratings ? supabaseService.getRatingSummary(context.userId) : Promise.resolve([]),
        ctx.friends ? friendshipService.getFriends(context.userId) : Promise.resolve({ success: true, data: [] }),
      ]);

      const [userProjects, recentUserActivity, recentAgentActivity, userAddress, ratingSummary, friendsResult] = conditionalResults;
      const userFriends = (friendsResult as any)?.success ? (friendsResult as any).data || [] : [];

      // Resolve timezone with validation
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      if (!isValidTimezone(userTimezone)) {
        console.error(`[CONVERSATION AGENT] Invalid timezone "${userTimezone}", falling back to UTC`);
        userTimezone = 'UTC';
      } else if (!userProfile?.timezone) {
        console.warn(`[CONVERSATION AGENT] User profile missing timezone, using ${userTimezone}`);
      }

      console.log(`[CONVERSATION AGENT] Using validated timezone: ${userTimezone}`);

      // Add current message to Zep BEFORE context retrieval so it's included in context
      try {
        await this.zepService.addUserMessage(context.userId, message);
      } catch (error) {
        console.warn('Failed to add user message to Zep:', error);
      }

      // Fetch Zep + rules ONCE here (not inside callModel which loops)
      let zepContext = '';
      try {
        const threadId = await this.zepService.getOrCreateSession(context.userId);
        const rawZep = await this.zepService.getThreadContext(threadId);
        // Cap Zep context to ~2000 chars (~500 tokens) to prevent bloat
        zepContext = rawZep.length > 2000 ? rawZep.slice(0, 2000) + '\n[context truncated]' : rawZep;
        console.log(`[CONVERSATION AGENT] Zep context: ${rawZep.length} chars${rawZep.length > 2000 ? ' (truncated to 2000)' : ''}`);
      } catch (error) {
        console.warn('Failed to load Zep context:', error);
      }

      let rulesCtx = '';
      if (routingDecision.context_sections.rules) {
        try {
          const userRules = await ruleService.getRules(context.userId);
          if (userRules.length > 0) {
            rulesCtx = ruleService.formatRulesForPrompt(userRules);
          }
        } catch (error) {
          console.warn('Failed to load rules:', error);
        }
      }

      // Filter and limit events: future/ongoing (max 15) + recent past 24h (max 5)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const futureEvents = allEvents
        .filter((event: any) => new Date(event.end_time) >= now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 15);
      const recentPastEvents = allEvents
        .filter((event: any) => {
          const endTime = new Date(event.end_time);
          return endTime < now && endTime >= twentyFourHoursAgo;
        })
        .sort((a: any, b: any) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())
        .slice(0, 5); // 5 most recent past events
      const userEvents = [...recentPastEvents, ...futureEvents];

      // Limit tasks (max 10)
      const userTasks = allTasks.slice(0, 10);

      // Limit goals (max 8)
      const userGoals = allGoals.slice(0, 8);

      console.log(`[CONVERSATION AGENT] Loaded: ${userEvents.length} events (${recentPastEvents.length} past + ${futureEvents.length} future), ${userTasks.length} tasks, ${userGoals.length} goals, ${userAspects?.length || 0} aspects`);

      // Build conversation history — 10 messages (5 exchanges) for adequate context
      const messages: BaseMessage[] = [];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory.slice(-10);
        for (const msg of recentHistory) {
          if (msg.role === 'user') {
            if (Array.isArray(msg.content)) {
              messages.push(new HumanMessage({ content: msg.content as any }));
            } else {
              messages.push(new HumanMessage(msg.content));
            }
          } else if (msg.role === 'assistant') {
            // Truncate long assistant messages in history
            const textContent = typeof msg.content === 'string' ? msg.content : '';
            const truncated = textContent.length > 500 ? textContent.slice(0, 500) + '...' : textContent;
            messages.push(new AIMessage(truncated));
          }
        }
      }

      // Add the current message
      messages.push(new HumanMessage(message));

      // Invoke LangGraph with enhanced context including proper timezone
      const result = await this.graph.invoke({
        messages: messages,
        userId: context.userId,
        timezone: userTimezone,
        userEvents: userEvents || [],
        userTasks: userTasks || [],
        userGoals: userGoals || [],
        userAspects: userAspects || [],
        userProjects: userProjects || [],
        userProfile: userProfile || null,
        recentUserActivity: recentUserActivity || [],
        recentAgentActivity: recentAgentActivity || [],
        currentPage: (context as any).currentPage || 'dashboard',
        currentLocation: context.location || null,
        currentAddress: userAddress || null,
        ratingSummary: ratingSummary || [],
        userFriends: userFriends || [],
        routingDecision: routingDecision,
        zepContext: zepContext,
        rulesContext: rulesCtx,
        memoryContext: memoryContext.graphiti ? {
          userNodeUuid: memoryContext.graphiti.userNodeUuid,
          relevantFacts: memoryContext.graphiti.relevantFacts.map((f: any) => f.fact).join('\n- '),
          totalFacts: memoryContext.graphiti.totalFacts
        } : null
      });

      // Get the last AI message
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];

      let response = lastAiMessage?.content || "Let me work on that for you...";

      // Track token usage — aggregate across ALL AI messages (not just the last one)
      // The agent may loop through tools multiple times, each producing an AI message with its own usage
      try {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let modelCallCount = 0;
        for (const msg of aiMessages) {
          const usage = msg?.usage_metadata || msg?.response_metadata?.tokenUsage;
          if (usage) {
            totalInputTokens += usage.input_tokens ?? usage.promptTokens ?? 0;
            totalOutputTokens += usage.output_tokens ?? usage.completionTokens ?? 0;
            modelCallCount++;
          }
        }
        if (totalInputTokens > 0 || totalOutputTokens > 0) {
          console.log(`[TOKEN TRACKING] processMessage: ${modelCallCount} model calls, input=${totalInputTokens}, output=${totalOutputTokens}`);
          Promise.resolve(
            getSupabaseClient()
              .from('agent_token_usage')
              .insert({
                user_id: context.userId,
                session_id: context.sessionId,
                model_name: 'gpt-5.1',
                input_tokens: totalInputTokens,
                output_tokens: totalOutputTokens,
                total_tokens: totalInputTokens + totalOutputTokens,
                model_calls: modelCallCount,
              })
          )
            .then(() => console.log(`[TOKEN TRACKING] Recorded ${totalInputTokens + totalOutputTokens} tokens for user ${context.userId}`))
            .catch((err: any) => console.warn('[TOKEN TRACKING] Failed to record:', err));
        }
      } catch (err) {
        console.warn('[TOKEN TRACKING] Error extracting usage:', err);
      }

      // Add assistant response to Zep (user message was already added before context retrieval)
      try {
        await this.zepService.addAssistantMessage(context.userId, response);
      } catch (error) {
        console.warn('Failed to add assistant message to Zep:', error);
      }

      return {
        content: response,
        type: 'text'
      };
    } catch (error) {
      console.error('Error processing message with LangGraph:', error);
      return {
        content: "Sorry, I encountered an error processing your request. Please try again.",
        type: 'text'
      };
    }
  }

  getSystemPrompt(): string {
    return `You are a helpful personal assistant that helps users manage their calendar and tasks through natural language commands.

IMPORTANT INSTRUCTIONS:
- Do NOT use emojis in any output, logging, or generated content
- Do NOT suggest or create aspect names with emojis
- Keep all responses and aspect names plain text without emoji characters
- When processing aspects, remove any emoji characters if provided by the user`;
  }

  getCapabilities(): string[] {
    return [
      "Create, update, delete calendar events",
      "Search and list calendar events",
      "Create tasks",
      "Natural language date/time parsing",
      "Smart defaults for event creation"
    ];
  }

  /**
   * Stream message processing for token-by-token output.
   * Uses LangGraph's streamEvents() method.
   * Supports optional images for vision capabilities.
   */
  async *streamMessage(context: AgentContext, message: string, images: ImageContent[] = []): AsyncGenerator<{
    type: 'text-delta' | 'tool-start' | 'tool-end' | 'error' | 'status';
    content?: string;
    toolName?: string;
    toolResult?: any;
  }> {
    try {
      // Immediately yield status so user sees activity
      yield { type: 'status', content: 'Loading your context...' };

      // Step 1: Route the message (cheap GPT-4.1-nano call)
      const recentMsgs = context.conversationHistory?.slice(-2).map(m =>
        typeof m.content === 'string' ? m.content : ''
      );
      const routingDecision = await this.contextRouter.route(message, recentMsgs);
      console.log(`[ROUTER] needs_tools=${routingDecision.needs_tools} tools=[${routingDecision.tools?.join(', ') || ''}] mode=${routingDecision.context_mode} | Categories: [${routingDecision.tool_categories.join(', ')}] | Prompts: [${routingDecision.prompt_sections.join(', ')}]`);

      const supabaseService = new SupabaseService();
      const ctx = routingDecision.context_sections;

      // Parallel data fetching — conditional based on routing
      const reverseGeocodePromise = context.location
        ? reverseGeocode(context.location.latitude, context.location.longitude).catch(() => null)
        : Promise.resolve(null);

      const friendshipService = new FriendshipService(supabaseService.getClient());

      const [memoryContext, userProfile, allEvents, allTasks, allGoals, userAspects, ...conditionalResults] = await Promise.all([
        this.loadMemoryContext(context, 'conversation'),
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
        // Conditional fetches
        ctx.projects ? projectService.getProjects(context.userId) : Promise.resolve([]),
        ctx.activity_logs ? supabaseService.getRecentActivity(context.userId, 'user', 30, 20) : Promise.resolve([]),
        ctx.activity_logs ? supabaseService.getRecentActivity(context.userId, 'agent', 60, 5) : Promise.resolve([]),
        reverseGeocodePromise,
        ctx.ratings ? supabaseService.getRatingSummary(context.userId) : Promise.resolve([]),
        ctx.friends ? friendshipService.getFriends(context.userId) : Promise.resolve({ success: true, data: [] }),
      ]);

      const [userProjects, recentUserActivity, recentAgentActivity, userAddress, ratingSummary, friendsResult] = conditionalResults;
      const userFriends = (friendsResult as any)?.success ? (friendsResult as any).data || [] : [];

      // Resolve timezone with validation
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      if (!isValidTimezone(userTimezone)) {
        console.error(`[CONVERSATION AGENT] Invalid timezone "${userTimezone}", falling back to UTC`);
        userTimezone = 'UTC';
      }

      console.log(`[CONVERSATION AGENT] Streaming with validated timezone: ${userTimezone}`);

      // Fetch Zep + rules ONCE here (not inside callModel which loops)
      let zepContext = '';
      try {
        const threadId = await this.zepService.getOrCreateSession(context.userId);
        const rawZep = await this.zepService.getThreadContext(threadId);
        zepContext = rawZep.length > 2000 ? rawZep.slice(0, 2000) + '\n[context truncated]' : rawZep;
        console.log(`[CONVERSATION AGENT] Zep context: ${rawZep.length} chars${rawZep.length > 2000 ? ' (truncated to 2000)' : ''}`);
      } catch (error) {
        console.warn('Failed to load Zep context:', error);
      }

      let rulesCtx = '';
      if (routingDecision.context_sections.rules) {
        try {
          const userRules = await ruleService.getRules(context.userId);
          if (userRules.length > 0) {
            rulesCtx = ruleService.formatRulesForPrompt(userRules);
          }
        } catch (error) {
          console.warn('Failed to load rules:', error);
        }
      }

      // Filter and limit events: future/ongoing (max 15) + recent past 24h (max 5)
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const futureEvents = allEvents
        .filter((event: any) => new Date(event.end_time) >= now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 15);
      const recentPastEvents = allEvents
        .filter((event: any) => {
          const endTime = new Date(event.end_time);
          return endTime < now && endTime >= twentyFourHoursAgo;
        })
        .sort((a: any, b: any) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())
        .slice(0, 5); // 5 most recent past events
      const userEvents = [...recentPastEvents, ...futureEvents];

      // Limit tasks and goals
      const userTasks = allTasks.slice(0, 10);
      const userGoals = allGoals.slice(0, 8);

      // Build conversation history — 10 messages (5 exchanges) for adequate context
      const messages: BaseMessage[] = [];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory.slice(-10);
        for (const msg of recentHistory) {
          if (msg.role === 'user') {
            if (Array.isArray(msg.content)) {
              messages.push(new HumanMessage({ content: msg.content as any }));
            } else {
              messages.push(new HumanMessage(msg.content));
            }
          } else if (msg.role === 'assistant') {
            const textContent = typeof msg.content === 'string' ? msg.content : '';
            const truncated = textContent.length > 500 ? textContent.slice(0, 500) + '...' : textContent;
            messages.push(new AIMessage(truncated));
          }
        }
      }

      // Add the current message (with images if present)
      if (images.length > 0) {
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: string } }> = [
          { type: 'text', text: message }
        ];
        for (const img of images) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: img.image_url.url, detail: img.image_url.detail || 'auto' }
          });
        }
        messages.push(new HumanMessage({ content: contentParts }));
        console.log(`[CONVERSATION AGENT] Added message with ${images.length} image(s)`);
      } else {
        messages.push(new HumanMessage(message));
      }

      // Build initial state
      const initialState = {
        messages: messages,
        userId: context.userId,
        timezone: userTimezone,
        userEvents: userEvents || [],
        userTasks: userTasks || [],
        userGoals: userGoals || [],
        userAspects: userAspects || [],
        userProjects: userProjects || [],
        userProfile: userProfile || null,
        recentUserActivity: recentUserActivity || [],
        recentAgentActivity: recentAgentActivity || [],
        currentPage: (context as any).currentPage || 'dashboard',
        currentLocation: context.location || null,
        currentAddress: userAddress || null,
        ratingSummary: ratingSummary || [],
        userFriends: userFriends || [],
        routingDecision: routingDecision,
        zepContext: zepContext,
        rulesContext: rulesCtx,
        memoryContext: memoryContext.graphiti ? {
          userNodeUuid: memoryContext.graphiti.userNodeUuid,
          relevantFacts: memoryContext.graphiti.relevantFacts.map((f: any) => f.fact).join('\n- '),
          totalFacts: memoryContext.graphiti.totalFacts
        } : null
      };

      // Signal that we're about to start generating
      yield { type: 'status', content: 'Thinking...' };

      // Stream events from LangGraph
      const eventStream = this.graph.streamEvents(initialState, {
        version: 'v2',
      });

      let fullResponse = '';
      let streamInputTokens = 0;
      let streamOutputTokens = 0;
      let modelCallCount = 0;
      const toolsUsed: string[] = [];
      const streamStartTime = Date.now();

      for await (const event of eventStream) {
        // Handle text streaming from the model
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data?.chunk;
          if (chunk && chunk.content && typeof chunk.content === 'string') {
            fullResponse += chunk.content;
            yield { type: 'text-delta', content: chunk.content };
          }
          // Skip token tracking from stream chunks — use on_chat_model_end only to avoid double counting
        }

        // Capture token usage from model end event (single source of truth)
        else if (event.event === 'on_chat_model_end') {
          modelCallCount++;
          const output = event.data?.output;
          if (output?.usage_metadata) {
            streamInputTokens += output.usage_metadata.input_tokens || 0;
            streamOutputTokens += output.usage_metadata.output_tokens || 0;
            console.log(`[TOKEN TRACKING] Model call #${modelCallCount}: input=${output.usage_metadata.input_tokens}, output=${output.usage_metadata.output_tokens}`);
          } else if (output?.response_metadata?.tokenUsage) {
            const tu = output.response_metadata.tokenUsage;
            streamInputTokens += tu.promptTokens || 0;
            streamOutputTokens += tu.completionTokens || 0;
            console.log(`[TOKEN TRACKING] Model call #${modelCallCount}: input=${tu.promptTokens}, output=${tu.completionTokens}`);
          }
        }

        // Handle tool execution start
        else if (event.event === 'on_tool_start') {
          console.log(`[STREAM] Tool starting: ${event.name}`);
          yield { type: 'tool-start', toolName: event.name };
          if (event.name && !toolsUsed.includes(event.name)) {
            toolsUsed.push(event.name);
          }
        }

        // Handle tool execution end
        else if (event.event === 'on_tool_end') {
          console.log(`[STREAM] Tool completed: ${event.name}`);
          yield { type: 'tool-end', toolName: event.name, toolResult: event.data?.output };
        }
      }

      // Track token usage after streaming (fire-and-forget)
      console.log(`[TOKEN TRACKING] Stream complete. ${modelCallCount} model calls. Total input: ${streamInputTokens}, output: ${streamOutputTokens}, Tools: [${toolsUsed.join(', ')}]`);
      if (streamInputTokens > 0 || streamOutputTokens > 0) {
        Promise.resolve(
          getSupabaseClient()
            .from('agent_token_usage')
            .insert({
              user_id: context.userId,
              session_id: context.sessionId,
              model_name: 'gpt-5.1',
              input_tokens: streamInputTokens,
              output_tokens: streamOutputTokens,
              total_tokens: streamInputTokens + streamOutputTokens,
              model_calls: modelCallCount,
              tools_used: toolsUsed,
              processing_time_ms: Date.now() - streamStartTime,
            })
        )
          .then(() => console.log(`[TOKEN TRACKING] Recorded ${streamInputTokens + streamOutputTokens} tokens (stream) for user ${context.userId}`))
          .catch((err: any) => console.warn('[TOKEN TRACKING] Failed to record:', err));
      }

      // Persist conversation to memory after streaming completes
      try {
        await this.persistConversationToMemory(context, message, fullResponse);
      } catch (error) {
        console.warn('Failed to persist conversation to memory:', error);
      }

    } catch (error) {
      console.error('Error in streamMessage:', error);
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown streaming error'
      };
    }
  }

  private buildRatingContext(ratingSummary: any[]): string {
    if (!ratingSummary || ratingSummary.length === 0) return '';

    const lines = ratingSummary.map(r => {
      const trendLabel = r.trend > 0 ? 'improving' : r.trend < 0 ? 'declining' : 'stable';
      const daysSince = Math.round((Date.now() - new Date(r.lastAsked).getTime()) / 86400000);
      const timeAgo = daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince}d ago`;
      return `  - "${r.topic}": ${r.latestScore}/10 (${trendLabel}, last: ${timeAgo}, ${r.totalEntries} entries)`;
    });

    return `\n\nUSER SELF-ASSESSMENT RATINGS:
${lines.join('\n')}
Use these scores to understand how the user feels about different areas of their life. If a score is declining, proactively suggest improvements.`;
  }

  /**
   * Format event context with compressed format
   */
  private formatEventContext(events: any[], timezone: string): string {
    if (events.length === 0) return '\n\nCALENDAR: No events';

    const lines = events.map(e => {
      const startDate = toDate(e.start_time);
      const endDate = toDate(e.end_time);
      const dateStr = formatInTimeZone(startDate, timezone, 'EEE M/d');
      const startTime = formatInTimeZone(startDate, timezone, 'h:mma').toLowerCase();
      const endTime = formatInTimeZone(endDate, timezone, 'h:mma').toLowerCase();
      const loc = e.location ? ` @${e.location}` : '';
      const aspect = e.aspect ? ` [${e.aspect}]` : '';
      return `- "${e.title}" ${dateStr} ${startTime}-${endTime}${loc}${aspect} #${e.id}`;
    });

    return `\n\nCALENDAR (${events.length}):\n${lines.join('\n')}`;
  }

  /**
   * Format task context with compressed format
   */
  private formatTaskContext(tasks: any[], timezone: string): string {
    if (tasks.length === 0) return '\n\nTASKS: None';

    const lines = tasks.map((t, i) => {
      const due = t.due_date ? ` due:${formatInTimeZone(toDate(t.due_date), timezone, 'M/d')}` : '';
      const pri = t.priority ? ` [${t.priority[0].toUpperCase()}]` : '';
      const status = t.status === 'completed' ? ' [done]' : t.status === 'in_progress' ? ' [wip]' : '';
      const aspect = t.aspect ? ` {${t.aspect}}` : '';
      return `${i + 1}. ${t.title}${pri}${due}${status}${aspect} #${t.id}`;
    });

    return `\n\nTASKS (${tasks.length}):\n${lines.join('\n')}`;
  }

  /**
   * Format goal context with compressed format
   */
  private formatGoalContext(goals: any[], timezone: string): string {
    if (goals.length === 0) return '\n\nGOALS: None';

    const lines = goals.map((g, i) => {
      const target = g.target_date ? ` by:${formatInTimeZone(toDate(g.target_date), timezone, 'MMM d')}` : '';
      const progress = g.progress != null ? ` ${g.progress}%` : '';
      const status = g.status ? ` [${g.status}]` : '';
      const aspect = g.aspect ? ` (${g.aspect})` : '';
      return `${i + 1}. ${g.title}${status}${progress}${target}${aspect} #${g.id}`;
    });

    return `\n\nGOALS (${goals.length}):\n${lines.join('\n')}`;
  }

  private createGraph(): any {
    // Get all tools from ToolRegistry (centralized tool management)
    const toolRegistry = ToolRegistry.getInstance();
    const allTools = toolRegistry.getAllTools();

    // ToolNode always has ALL tools (can execute anything the model requests)
    const toolNode = new ToolNode(allTools);

    // Register tools with the base agent
    this.registerTools(allTools);

    console.log(`[CONVERSATION AGENT] Loaded ${allTools.length} tools from ToolRegistry`);

    // Slim continuation prompt for tool re-entry (saves ~3K tokens per loop)
    const CONTINUATION_PROMPT = `You are Glyde, a life assistant. You just executed tools. Respond to the user based on the tool results. Be concise (1-3 sentences). Use 12-hour AM/PM for times.

CRITICAL: If the user asked you to create, update, or delete something and you have NOT yet called the corresponding tool, you MUST call it now. NEVER tell the user you did something without a tool call proving it. If a tool call failed, tell the user honestly.
For multi-action requests, call ALL remaining tools before responding. Do NOT stop to ask clarifying questions mid-execution — use reasonable defaults and keep going. Summarize everything at the end.`;

    // Define the workflow nodes
    const callModel = async (state: ConversationStateType) => {
      // Detect if this is a re-entry after tool execution
      const lastMsg = state.messages[state.messages.length - 1];
      const isToolReentry = lastMsg?._getType() === 'tool';

      // Dynamic tool binding based on routing decision
      const routing = state.routingDecision;
      const needsTools = routing?.needs_tools !== false; // default true for safety

      let selectedTools: any[] = [];
      if (needsTools) {
        // Use specific tool names + categories for precise binding
        if (routing?.tools?.length || routing?.tool_categories?.length) {
          selectedTools = toolRegistry.getToolsForRouting(routing?.tools, routing?.tool_categories);
        } else {
          selectedTools = allTools;
        }
      }

      // Zero-tool mode: invoke without bindTools when no tools needed
      const model = needsTools && selectedTools.length > 0
        ? this.model.bindTools(selectedTools)
        : this.model;

      let messages: BaseMessage[];

      if (isToolReentry) {
        // RE-ENTRY: Use slim continuation prompt (saves ~3K+ tokens)
        messages = [new SystemMessage(CONTINUATION_PROMPT), ...state.messages];
        console.log(`[AGENT NODE] Tool re-entry: slim prompt, ${messages.length} messages (${selectedTools.length} tools)`);
      } else {
        // FIRST CALL: Build system prompt based on context mode
        const contextMode = routing?.context_mode || 'full';

        const nowUtc = new Date();
        const todayFormatted = formatInTimeZone(nowUtc, state.timezone, 'yyyy-MM-dd');
        const tomorrowDayName = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'EEEE');
        const tomorrowFormatted = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'yyyy-MM-dd');

        if (contextMode === 'summary' && !needsTools) {
          // SUMMARY MODE: Compact prompt, no tools, minimal context
          const summaryCtx = buildSummaryContext(
            state.userEvents || [],
            state.userTasks || [],
            state.userGoals || [],
            state.timezone
          );

          const systemMessage = buildSystemPrompt({
            timezone: state.timezone,
            eventContext: '',
            taskContext: '',
            goalContext: '',
            todayFormatted,
            tomorrowFormatted,
            tomorrowDayName,
            messageCount: state.messages.length,
            zepGraphContext: state.zepContext || '',
            userProfile: state.userProfile,
            contextMode: 'summary',
            summaryContext: summaryCtx,
          });

          messages = [systemMessage, ...state.messages];
          console.log(`[AGENT NODE] Summary mode: compact prompt, ${messages.length} messages, 0 tools`);
        } else {
          // FULL MODE: Detailed prompt with context
          let recentEvents: any[] = [];
          if (state.userEvents && state.userEvents.length > 0) {
            recentEvents = state.userEvents;
          } else {
            try {
              const supabaseService = new SupabaseService();
              const now = new Date();
              const allEventsData = await supabaseService.getEventsForAgent(state.userId);
              recentEvents = allEventsData.filter(event => new Date(event.end_time) >= now);
            } catch (error) {
              console.error('Error loading recent events for context:', error);
            }
          }

          const eventContext = this.formatEventContext(recentEvents, state.timezone);
          const taskContext = this.formatTaskContext(state.userTasks || [], state.timezone);
          const goalContext = this.formatGoalContext(state.userGoals || [], state.timezone);

          const zepThreadContext = state.zepContext || '';
          const rulesContext = state.rulesContext || '';

          let locationContext: string | undefined;
          if (state.currentLocation) {
            const coords = `${state.currentLocation.latitude}, ${state.currentLocation.longitude}`;
            locationContext = state.currentAddress
              ? `${state.currentAddress} (${coords})`
              : coords;
          }

          const systemMessage = buildSystemPrompt({
            timezone: state.timezone,
            eventContext,
            taskContext,
            goalContext,
            todayFormatted,
            tomorrowFormatted,
            tomorrowDayName,
            toolCount: selectedTools.length,
            zepGraphContext: zepThreadContext,
            rulesContext,
            userAspects: state.userAspects,
            userProjects: routing?.context_sections.projects ? state.userProjects : [],
            userProfile: state.userProfile,
            recentUserActivity: routing?.context_sections.activity_logs ? state.recentUserActivity : [],
            recentAgentActivity: routing?.context_sections.activity_logs ? state.recentAgentActivity : [],
            currentPage: state.currentPage,
            messageCount: state.messages.length,
            currentLocation: locationContext,
            ratingContext: routing?.context_sections.ratings && state.ratingSummary?.length
              ? this.buildRatingContext(state.ratingSummary)
              : undefined,
            userFriends: routing?.context_sections.friends ? state.userFriends : [],
            promptSections: routing?.prompt_sections,
            contextMode: 'full',
          });

          messages = [systemMessage, ...state.messages];
          console.log(`[AGENT NODE] Full mode: ${messages.length} messages (${selectedTools.length} tools)`);
        }
      }

      const response = await model.invoke(messages);
      const toolCalls = (response as any).tool_calls?.length || 0;
      console.log(`[AGENT NODE] Response: ${toolCalls} tool_calls${toolCalls > 0 ? ': ' + (response as any).tool_calls.map((t: any) => t.name || t.tool).join(', ') : ''}`);

      return {
        messages: [response],
      };
    };

    const executeTools = async (state: ConversationStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        console.log(`[TOOLS NODE] Executing ${(lastMessage as any).tool_calls.length} tool calls:`, (lastMessage as any).tool_calls.map((t: any) => t.name || t.tool));
        const toolResults = await toolNode.invoke(state, {
          configurable: {
            userId: state.userId,
            timezone: state.timezone
          }
        });
        console.log(`[TOOLS NODE] Tool execution completed`);
        return {
          messages: toolResults.messages,
        };
      }
      return {};
    };

    // Determine if we should continue to tools or finish
    const shouldContinue = (state: ConversationStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        return "tools";
      }
      return "__end__";
    };

    // Build the graph with standard LangGraph pattern
    const workflow = new StateGraph(ConversationState)
      .addNode("agent", callModel)
      .addNode("tools", executeTools)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent"); // Loop back to agent after tool execution

    return workflow.compile();
  }

}
