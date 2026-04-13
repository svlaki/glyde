import { StateGraph, Annotation } from "@langchain/langgraph";
// ChatOpenAI is imported by BaseAgent
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SupabaseService, ActivityLogEntry, getSupabaseClient } from '../../services/SupabaseService.js';
import projectService from '../../services/ProjectService.js';
import ruleService from '../../services/RuleService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse, ImageContent } from '../../types/agents.js';
import { ToolCategory } from '../../types/routing.js';
import { isValidTimezone } from '../../utils/timezoneUtils.js';
import { toDate, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { reverseGeocode } from '../../tools/search/location-search.js';
import { buildSystemPrompt } from './prompts.js';
import { classifyIntent, isOperationalMessage } from './intent-router.js';
import { DatabaseProfile } from '../../types/database.js';
import { FriendshipService } from '../../services/FriendshipService.js';

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
  memoryFactContext: Annotation<string>({
    reducer: (_existing, update) => update || _existing,
    default: () => '',
  }),
  rulesContext: Annotation<string>({
    reducer: (_existing, update) => update || _existing,
    default: () => '',
  }),
  selectedToolNames: Annotation<string[]>({
    reducer: (_existing, update) => update && update.length > 0 ? update : _existing,
    default: () => [],
  }),
  selectedCategories: Annotation<ToolCategory[]>({
    reducer: (_existing: ToolCategory[], update: ToolCategory[]) => update && update.length > 0 ? update : _existing,
    default: (): ToolCategory[] => [],
  }),
});

type ConversationStateType = typeof ConversationState.State;

export class ConversationAgent extends BaseAgent {
  private graph: any;

  constructor() {
    super('conversation', "gpt-5.4-mini"); // gpt-5.4-mini: best cost/intelligence ratio, supports prompt caching
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      // Classify intent early to conditionally load context
      const categories = classifyIntent(message, (context as any).currentPage);
      const catSet = new Set(categories);
      const needsProjects = catSet.has('projects');
      const needsLocation = catSet.has('search') && !!context.location;

      // Pre-load user data for LangGraph context
      const supabaseService = new SupabaseService();

      const reverseGeocodePromise = needsLocation && context.location
        ? reverseGeocode(context.location.latitude, context.location.longitude).catch(() => null)
        : Promise.resolve(null);

      // Always load friends -- lightweight query, and friend names are needed
      // for context even when intent doesn't explicitly mention "friend"
      const friendshipService = new FriendshipService(supabaseService.getClient());

      // Fetch core data in parallel, skip optional context based on intent
      const [userProfile, allEvents, allTasks, allGoals, userAspects, userProjects, recentUserActivity, recentAgentActivity, userAddress, ratingSummary, friendsResult] = await Promise.all([
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
        needsProjects ? projectService.getProjects(context.userId) : Promise.resolve([]),
        supabaseService.getRecentActivity(context.userId, 'user', 30, 20),
        supabaseService.getRecentActivity(context.userId, 'agent', 60, 5),
        reverseGeocodePromise,
        supabaseService.getRatingSummary(context.userId),
        friendshipService.getFriends(context.userId),
      ]);

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

      // Fetch memory context + rules ONCE here (not inside callModel which loops)
      let memoryFactCtx = '';
      try {
        const rawCtx = await this.memoryService.getUserContext(context.userId);
        // Cap context to ~2000 chars (~500 tokens) to prevent bloat
        memoryFactCtx = rawCtx.length > 2000 ? rawCtx.slice(0, 2000) + '\n[context truncated]' : rawCtx;
        console.log(`[CONVERSATION AGENT] Memory context: ${rawCtx.length} chars${rawCtx.length > 2000 ? ' (truncated to 2000)' : ''}`);
      } catch (error) {
        console.warn('Failed to load memory context:', error);
      }

      let rulesCtx = '';
      try {
        const userRules = await ruleService.getRules(context.userId);
        if (userRules.length > 0) {
          rulesCtx = ruleService.formatRulesForPrompt(userRules);
        }
      } catch (error) {
        console.warn('Failed to load rules:', error);
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
        .slice(0, 5);
      const userEvents = [...recentPastEvents, ...futureEvents];

      const userTasks = allTasks.slice(0, 10);
      const userGoals = allGoals.slice(0, 8);

      console.log(`[CONVERSATION AGENT] Loaded: ${userEvents.length} events (${recentPastEvents.length} past + ${futureEvents.length} future), ${userTasks.length} tasks, ${userGoals.length} goals, ${userAspects?.length || 0} aspects`);

      const messages: BaseMessage[] = [];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory.slice(-10);
        const totalMsgs = recentHistory.length;
        for (let i = 0; i < totalMsgs; i++) {
          const msg = recentHistory[i];
          const isRecent = i >= totalMsgs - 4; // last 4 messages (2 exchanges) kept full
          if (msg.role === 'user') {
            if (Array.isArray(msg.content)) {
              messages.push(new HumanMessage({ content: msg.content as any }));
            } else {
              messages.push(new HumanMessage(msg.content));
            }
          } else if (msg.role === 'assistant') {
            const textContent = typeof msg.content === 'string' ? msg.content : '';
            if (isRecent) {
              // Keep recent assistant messages full so agent can see its own actions
              const truncated = textContent.length > 1500 ? textContent.slice(0, 1500) + '...' : textContent;
              messages.push(new AIMessage(truncated));
            } else {
              // Older messages get heavier truncation
              const truncated = textContent.length > 400 ? textContent.slice(0, 400) + '...' : textContent;
              messages.push(new AIMessage(truncated));
            }
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
        memoryFactContext: memoryFactCtx,
        rulesContext: rulesCtx,
      }, { recursionLimit: 15 });

      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];

      let response = lastAiMessage?.content || "Let me work on that for you...";

      // Track token usage — aggregate across ALL AI messages (not just the last one)
      // The agent may loop through tools multiple times, each producing an AI message with its own usage
      try {
        this.trackTokenUsage(context.userId, context.sessionId, aiMessages);
      } catch (err) {
        console.warn('[TOKEN TRACKING] Error extracting usage:', err);
      }

      // Persist conversation to memory (fact extraction happens here)
      // Skip for short operational messages that won't contain new user facts
      if (!isOperationalMessage(message)) {
        try {
          await this.persistConversationToMemory(context, message, response);
        } catch (error) {
          console.warn('Failed to persist conversation to memory:', error);
        }
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

      // Classify intent early to conditionally load context
      const categories = classifyIntent(message, (context as any).currentPage);
      const catSet = new Set(categories);
      const needsFriends = catSet.has('friends') || catSet.has('shared-events') || catSet.has('shared-aspects');
      const needsProjects = catSet.has('projects');
      const needsLocation = catSet.has('search') && !!context.location;

      const supabaseService = new SupabaseService();

      const reverseGeocodePromise = needsLocation && context.location
        ? reverseGeocode(context.location.latitude, context.location.longitude).catch(() => null)
        : Promise.resolve(null);

      const friendshipService = needsFriends
        ? new FriendshipService(supabaseService.getClient())
        : null;

      // Fetch core data in parallel, skip optional context based on intent
      const [userProfile, allEvents, allTasks, allGoals, userAspects, userProjects, recentUserActivity, recentAgentActivity, userAddress, ratingSummary, friendsResult] = await Promise.all([
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
        needsProjects ? projectService.getProjects(context.userId) : Promise.resolve([]),
        supabaseService.getRecentActivity(context.userId, 'user', 30, 20),
        supabaseService.getRecentActivity(context.userId, 'agent', 60, 5),
        reverseGeocodePromise,
        supabaseService.getRatingSummary(context.userId),
        friendshipService ? friendshipService.getFriends(context.userId) : Promise.resolve({ success: true, data: [] }),
      ]);

      const userFriends = (friendsResult as any)?.success ? (friendsResult as any).data || [] : [];

      // Resolve timezone with validation
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      if (!isValidTimezone(userTimezone)) {
        console.error(`[CONVERSATION AGENT] Invalid timezone "${userTimezone}", falling back to UTC`);
        userTimezone = 'UTC';
      }

      console.log(`[CONVERSATION AGENT] Streaming with validated timezone: ${userTimezone}`);

      // Fetch memory context + rules ONCE here (not inside callModel which loops)
      let memoryFactCtx = '';
      try {
        const rawCtx = await this.memoryService.getUserContext(context.userId);
        memoryFactCtx = rawCtx.length > 2000 ? rawCtx.slice(0, 2000) + '\n[context truncated]' : rawCtx;
        console.log(`[CONVERSATION AGENT] Memory context: ${rawCtx.length} chars${rawCtx.length > 2000 ? ' (truncated to 2000)' : ''}`);
      } catch (error) {
        console.warn('Failed to load memory context:', error);
      }

      let rulesCtx = '';
      try {
        const userRules = await ruleService.getRules(context.userId);
        if (userRules.length > 0) {
          rulesCtx = ruleService.formatRulesForPrompt(userRules);
        }
      } catch (error) {
        console.warn('Failed to load rules:', error);
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
        .slice(0, 5);
      const userEvents = [...recentPastEvents, ...futureEvents];

      const userTasks = allTasks.slice(0, 10);
      const userGoals = allGoals.slice(0, 8);

      const messages: BaseMessage[] = [];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory.slice(-10);
        const totalMsgs = recentHistory.length;
        for (let i = 0; i < totalMsgs; i++) {
          const msg = recentHistory[i];
          const isRecent = i >= totalMsgs - 4; // last 4 messages (2 exchanges) kept full
          if (msg.role === 'user') {
            if (Array.isArray(msg.content)) {
              messages.push(new HumanMessage({ content: msg.content as any }));
            } else {
              messages.push(new HumanMessage(msg.content));
            }
          } else if (msg.role === 'assistant') {
            const textContent = typeof msg.content === 'string' ? msg.content : '';
            if (isRecent) {
              const truncated = textContent.length > 1500 ? textContent.slice(0, 1500) + '...' : textContent;
              messages.push(new AIMessage(truncated));
            } else {
              const truncated = textContent.length > 400 ? textContent.slice(0, 400) + '...' : textContent;
              messages.push(new AIMessage(truncated));
            }
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
        memoryFactContext: memoryFactCtx,
        rulesContext: rulesCtx,
      };

      yield { type: 'status', content: 'Thinking...' };

      // Stream events from LangGraph
      const eventStream = this.graph.streamEvents(initialState, {
        version: 'v2',
        recursionLimit: 15,
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
              model_name: this.modelName,
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
      // Skip for short operational messages that won't contain new user facts
      if (!isOperationalMessage(message)) {
        try {
          await this.persistConversationToMemory(context, message, fullResponse);
        } catch (error) {
          console.warn('Failed to persist conversation to memory:', error);
        }
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

  /**
   * Extract the last user message text from the message list for intent classification.
   */
  private extractUserMessage(messages: BaseMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]._getType() === 'human') {
        const content = messages[i].content;
        return typeof content === 'string' ? content : '';
      }
    }
    return '';
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
    const CONTINUATION_PROMPT = `You are Glyde, a life assistant. You just executed tools. Respond based on tool results. Be concise (1-3 sentences). Use 12-hour AM/PM.

TOOL RESULT VERIFICATION (MANDATORY):
1. READ EVERY tool result message below. Each tool call produced a result.
2. If ANY result starts with "Error" or contains "failed" or "returned null", that tool call FAILED. The action did NOT happen. Do NOT claim it succeeded.
3. NEVER claim you created/updated/deleted something unless the tool result confirms success with specific details (event ID, title, time).
4. Count your successes: if you called 5 tools and only 2 returned success, only 2 actions happened. Tell the user exactly which ones failed.

INCOMPLETE WORK:
- If the user asked for multiple items and some tool calls failed, RETRY the failed ones NOW before responding.
- If schedule info was mentioned and you have NOT yet called create_recurring_event or create_event for ALL items, keep going.
- Creating an aspect without the corresponding events is incomplete.

CONFLICT CHECK: After creating multiple events, check for time overlaps and flag them.
Summarize ONLY what ACTUALLY succeeded, with names and times.`;

    const callModel = async (state: ConversationStateType) => {
      const lastMsg = state.messages[state.messages.length - 1];
      const isToolReentry = lastMsg?._getType() === 'tool';

      // Determine which tools to bind: reuse from state on re-entry, classify on first call
      let selectedTools: any[];
      let selectedToolNames: string[];
      let selectedCategories: ToolCategory[];

      if (isToolReentry && state.selectedToolNames.length > 0) {
        // RE-ENTRY: Reuse same tool set from first call
        selectedTools = toolRegistry.getTools(state.selectedToolNames);
        selectedToolNames = state.selectedToolNames;
        selectedCategories = state.selectedCategories;
      } else {
        // FIRST CALL: Classify intent and select relevant tools
        const userMessage = this.extractUserMessage(state.messages);
        const categories = classifyIntent(userMessage, state.currentPage);
        selectedTools = toolRegistry.getToolsForCategories(categories);
        selectedToolNames = selectedTools.map((t: any) => t.name);
        selectedCategories = categories;
        console.log(`[INTENT ROUTER] Selected ${selectedTools.length}/${allTools.length} tools for request`);
      }

      // Bind only the selected tools to the model for this invocation
      const modelWithTools = this.model.bindTools(selectedTools);

      let messages: BaseMessage[];

      if (isToolReentry) {
        // RE-ENTRY: Use slim continuation prompt (saves ~3K+ tokens)
        messages = [new SystemMessage(CONTINUATION_PROMPT), ...state.messages];
        console.log(`[AGENT NODE] Tool re-entry: slim prompt, ${messages.length} messages (${selectedTools.length} tools)`);
      } else {
        // FIRST CALL: Build full system prompt with all context
        const nowUtc = new Date();
        const todayFormatted = formatInTimeZone(nowUtc, state.timezone, 'yyyy-MM-dd');
        const tomorrowDayName = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'EEEE');
        const tomorrowFormatted = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'yyyy-MM-dd');

        const eventContext = this.formatEventContext(state.userEvents || [], state.timezone);
        const taskContext = this.formatTaskContext(state.userTasks || [], state.timezone);
        const goalContext = this.formatGoalContext(state.userGoals || [], state.timezone);

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
          zepGraphContext: state.memoryFactContext || '',
          rulesContext: state.rulesContext || '',
          userAspects: state.userAspects,
          userProjects: state.userProjects,
          userProfile: state.userProfile,
          recentUserActivity: state.recentUserActivity,
          recentAgentActivity: state.recentAgentActivity,
          currentPage: state.currentPage,
          messageCount: state.messages.length,
          currentLocation: locationContext,
          ratingContext: state.ratingSummary?.length
            ? this.buildRatingContext(state.ratingSummary)
            : undefined,
          userFriends: state.userFriends,
          activeCategories: selectedCategories,
        });

        messages = [systemMessage, ...state.messages];
        console.log(`[AGENT NODE] Full prompt: ${messages.length} messages (${selectedTools.length} tools bound)`);
      }

      const response = await modelWithTools.invoke(messages);
      const toolCalls = (response as any).tool_calls?.length || 0;
      const responseText = typeof response.content === 'string' ? response.content : '';
      console.log(`[AGENT NODE] Response: ${toolCalls} tool_calls${toolCalls > 0 ? ': ' + (response as any).tool_calls.map((t: any) => t.name || t.tool).join(', ') : ''}`);

      // Detect hallucinated actions: model claims to have done something without calling tools
      if (toolCalls === 0 && responseText.length > 0 && !isToolReentry) {
        const actionClaims = /\b(created|added|scheduled|updated|deleted|moved|removed)\b/i;
        if (actionClaims.test(responseText)) {
          console.warn(`[AGENT NODE] WARNING: Model claims actions ("${responseText.slice(0, 100)}...") but made 0 tool calls. Possible hallucination.`);
        }
      }

      return {
        messages: [response],
        selectedToolNames,
        selectedCategories,
      };
    };

    const executeTools = async (state: ConversationStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        const toolCalls = (lastMessage as any).tool_calls;
        console.log(`[TOOLS NODE] Executing ${toolCalls.length} tool calls:`, toolCalls.map((t: any) => t.name || t.tool));

        const toolResults = await toolNode.invoke(state, {
          configurable: {
            userId: state.userId,
            timezone: state.timezone
          }
        });

        // Audit tool results: detect failures so the model can't hallucinate success.
        // ToolNode catches errors and returns them as ToolMessage content strings.
        // We log failures loudly and prepend a summary so the model sees them clearly.
        const resultMessages = toolResults.messages || [];
        const failures: string[] = [];
        for (const msg of resultMessages) {
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          const toolName = msg.name || 'unknown';
          if (content.startsWith('Error:') || content.startsWith('Error ') || content.includes('failed') || content.includes('returned null')) {
            console.error(`[TOOLS NODE] TOOL FAILED: ${toolName} -> ${content.slice(0, 200)}`);
            failures.push(`${toolName}: ${content.slice(0, 150)}`);
          }
        }

        if (failures.length > 0) {
          console.error(`[TOOLS NODE] ${failures.length}/${toolCalls.length} tool calls FAILED`);
        } else {
          console.log(`[TOOLS NODE] All ${toolCalls.length} tool calls succeeded`);
        }

        return {
          messages: resultMessages,
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
