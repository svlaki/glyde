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
import { buildSystemPrompt } from './prompts.js';
import { DatabaseProfile, DatabaseAspect } from '../../types/database.js';
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
});

type ConversationStateType = typeof ConversationState.State;

export class ConversationAgent extends BaseAgent {
  private graph: any;

  constructor() {
    super('conversation', "gpt-5.1"); // Use GPT-5.1 for best intelligence
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      // Load memory context using Graphiti
      const memoryContext = await this.loadMemoryContext(context, 'conversation');

      // Pre-load user data for LangGraph context
      const supabaseService = new SupabaseService();

      // Parallel data fetching for better performance
      const reverseGeocodePromise = context.location
        ? reverseGeocode(context.location.latitude, context.location.longitude).catch(() => null)
        : Promise.resolve(null);

      const friendshipService = new FriendshipService(supabaseService.getClient());

      const [userProfile, allEvents, allTasks, allGoals, userAspects, userProjects, recentUserActivity, recentAgentActivity, userAddress, ratingSummary, friendsResult] = await Promise.all([
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
        projectService.getProjects(context.userId),
        supabaseService.getRecentActivity(context.userId, 'user', 30, 20),
        supabaseService.getRecentActivity(context.userId, 'agent', 60, 5),
        reverseGeocodePromise,
        supabaseService.getRatingSummary(context.userId),
        friendshipService.getFriends(context.userId),
      ]);

      const userFriends = friendsResult.success ? friendsResult.data || [] : [];

      // Resolve timezone with validation
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      // Validate timezone - fall back to UTC if invalid
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

      // Filter and limit events (max 15 future/ongoing events)
      const now = new Date();
      const userEvents = allEvents
        .filter((event: any) => new Date(event.end_time) >= now)
        .slice(0, 15);
      console.log(`Loading ${userEvents?.length || 0} future/ongoing events (limited from ${allEvents?.length || 0} total) for user ${context.userId}`);

      // Limit tasks (max 10)
      const userTasks = allTasks.slice(0, 10);
      console.log(`Loading ${userTasks?.length || 0} tasks (limited from ${allTasks?.length || 0} total) for user ${context.userId}`);

      // Limit goals (max 8)
      const userGoals = allGoals.slice(0, 8);
      console.log(`Loading ${userGoals?.length || 0} goals (limited from ${allGoals?.length || 0} total) for user ${context.userId}`);

      console.log(`Loading ${userAspects?.length || 0} aspects for user ${context.userId}`);
      console.log(`Loading ${recentUserActivity?.length || 0} recent user activities, ${recentAgentActivity?.length || 0} recent agent activities`);

      // Build conversation history from context
      const messages: BaseMessage[] = [];
      
      // Add conversation history if available
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        // Keep last 10 messages for context (5 exchanges)
        const recentHistory = context.conversationHistory.slice(-10);
        for (const msg of recentHistory) {
          if (msg.role === 'user') {
            // Handle multipart content (text + images from recent messages)
            if (Array.isArray(msg.content)) {
              messages.push(new HumanMessage({ content: msg.content as any }));
            } else {
              messages.push(new HumanMessage(msg.content));
            }
          } else if (msg.role === 'assistant') {
            const textContent = typeof msg.content === 'string' ? msg.content : '';
            messages.push(new AIMessage(textContent));
          }
        }
      }

      // Add the current message
      messages.push(new HumanMessage(message));
      
      // Invoke LangGraph with enhanced context including proper timezone
      const result = await this.graph.invoke({
        messages: messages,
        userId: context.userId,
        timezone: userTimezone, // Use resolved timezone from profile, context, or UTC fallback
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
        // Add Graphiti memory context
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

      // Track token usage (fire-and-forget)
      try {
        const usage = lastAiMessage?.usage_metadata || lastAiMessage?.response_metadata?.tokenUsage;
        if (usage) {
          const inputTokens = usage.input_tokens ?? usage.promptTokens ?? 0;
          const outputTokens = usage.output_tokens ?? usage.completionTokens ?? 0;
          Promise.resolve(
            getSupabaseClient()
              .from('agent_token_usage')
              .insert({
                user_id: context.userId,
                session_id: context.sessionId,
                model_name: 'gpt-5.1',
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens,
              })
          )
            .then(() => console.log(`[TOKEN TRACKING] Recorded ${inputTokens + outputTokens} tokens for user ${context.userId}`))
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

      const supabaseService = new SupabaseService();

      // Parallel data fetching - run all async operations concurrently
      // This significantly reduces time-to-first-token
      // Also reverse-geocode user's location if available
      const reverseGeocodePromise = context.location
        ? reverseGeocode(context.location.latitude, context.location.longitude).catch(() => null)
        : Promise.resolve(null);

      const friendshipService = new FriendshipService(supabaseService.getClient());

      const [memoryContext, userProfile, allEvents, allTasks, allGoals, userAspects, userProjects, recentUserActivity, recentAgentActivity, userAddress, ratingSummary, friendsResult] = await Promise.all([
        this.loadMemoryContext(context, 'conversation'),
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
        supabaseService.getGoals(context.userId),
        supabaseService.getAspects(context.userId),
        projectService.getProjects(context.userId),
        supabaseService.getRecentActivity(context.userId, 'user', 30, 20),
        supabaseService.getRecentActivity(context.userId, 'agent', 60, 5),
        reverseGeocodePromise,
        supabaseService.getRatingSummary(context.userId),
        friendshipService.getFriends(context.userId),
      ]);

      const userFriends = friendsResult.success ? friendsResult.data || [] : [];

      // Resolve timezone with validation
      let userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      // Validate timezone - fall back to UTC if invalid
      if (!isValidTimezone(userTimezone)) {
        console.error(`🌊 [CONVERSATION AGENT] Invalid timezone "${userTimezone}", falling back to UTC`);
        userTimezone = 'UTC';
      }

      console.log(`🌊 [CONVERSATION AGENT] Streaming with validated timezone: ${userTimezone}`);

      // Filter and limit events (max 15 future/ongoing events)
      const now = new Date();
      const userEvents = allEvents
        .filter((event: any) => new Date(event.end_time) >= now)
        .slice(0, 15);

      // Limit tasks and goals
      const userTasks = allTasks.slice(0, 10);
      const userGoals = allGoals.slice(0, 8);

      // Build conversation history from context
      const messages: BaseMessage[] = [];

      // Add conversation history if available
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        // Keep last 10 messages for context (5 exchanges)
        const recentHistory = context.conversationHistory.slice(-10);
        for (const msg of recentHistory) {
          if (msg.role === 'user') {
            // Handle multipart content (text + images from recent messages)
            if (Array.isArray(msg.content)) {
              messages.push(new HumanMessage({ content: msg.content as any }));
            } else {
              messages.push(new HumanMessage(msg.content));
            }
          } else if (msg.role === 'assistant') {
            // Assistant messages are always text-only
            const textContent = typeof msg.content === 'string' ? msg.content : '';
            messages.push(new AIMessage(textContent));
          }
        }
      }

      // Add the current message (with images if present)
      if (images.length > 0) {
        // Build multipart content for vision
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
          // Accumulate token usage from streaming chunks (final chunk has totals)
          if (chunk?.usage_metadata) {
            if (chunk.usage_metadata.input_tokens) streamInputTokens = chunk.usage_metadata.input_tokens;
            if (chunk.usage_metadata.output_tokens) streamOutputTokens = chunk.usage_metadata.output_tokens;
          }
        }

        // Capture token usage from model end event (primary source for LangGraph streamEvents)
        else if (event.event === 'on_chat_model_end') {
          const output = event.data?.output;
          if (output?.usage_metadata) {
            streamInputTokens += output.usage_metadata.input_tokens || 0;
            streamOutputTokens += output.usage_metadata.output_tokens || 0;
          } else if (output?.response_metadata?.tokenUsage) {
            const tu = output.response_metadata.tokenUsage;
            streamInputTokens += tu.promptTokens || 0;
            streamOutputTokens += tu.completionTokens || 0;
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
      console.log(`[TOKEN TRACKING] Stream complete. Input: ${streamInputTokens}, Output: ${streamOutputTokens}, Tools: [${toolsUsed.join(', ')}]`);
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

  private createGraph(): any {
    // Get all tools from ToolRegistry (centralized tool management)
    const toolRegistry = ToolRegistry.getInstance();
    const tools = toolRegistry.getAllTools();
    const toolNode = new ToolNode(tools);

    // Bind tools to the model
    const modelWithTools = this.model.bindTools(tools);

    // Register tools with the base agent
    this.registerTools(tools);

    console.log(`🔧 [CONVERSATION AGENT] Loaded ${tools.length} tools from ToolRegistry`);

    // Define the workflow nodes
    const callModel = async (state: ConversationStateType) => {
      // Load recent events for context using SupabaseService
      let recentEvents: any[] = [];

      // Use pre-loaded events if available, otherwise fetch them
      if (state.userEvents && state.userEvents.length > 0) {
        recentEvents = state.userEvents;
        console.log(`Using ${recentEvents.length} pre-loaded events for context`);
      } else {
        try {
          const supabaseService = new SupabaseService();
          // Filter to only include events that haven't ended yet (including ongoing multi-day events)
          const now = new Date();
          const allEventsData = await supabaseService.getEventsForAgent(state.userId);
          const eventsData = allEventsData.filter(event => new Date(event.end_time) >= now);

          if (eventsData && eventsData.length > 0) {
            recentEvents = eventsData;
            console.log(`Found ${recentEvents.length} future/ongoing events (filtered from ${allEventsData.length} total) for user context`);
          } else {
            console.log('No future/ongoing events found for user context');
          }
        } catch (error) {
          console.error('Error loading recent events for context:', error);
        }
      }

      const eventContext = recentEvents.length > 0
        ? `\n\nUSER'S CALENDAR EVENTS (${recentEvents.length} total):\n${recentEvents.map((e) => {
            // Events are UTC from database - format for user's timezone display
            const startDate = toDate(e.start_time);
            const endDate = toDate(e.end_time);

            // Format times in user's timezone using date-fns-tz
            const dateStr = formatInTimeZone(startDate, state.timezone, 'EEE, MMM d');
            const startTime = formatInTimeZone(startDate, state.timezone, 'h:mm a');
            const endTime = formatInTimeZone(endDate, state.timezone, 'h:mm a');

            // Determine time of day based on user's timezone
            const localHour = parseInt(formatInTimeZone(startDate, state.timezone, 'H'));
            const timeOfDay = localHour < 12 ? 'morning' : localHour < 17 ? 'afternoon' : 'evening';

            const aspectStr = e.aspect ? ` [${e.aspect}]` : '';
            return `- "${e.title}" on ${dateStr} (${timeOfDay}) from ${startTime} to ${endTime}${e.location ? ` at ${e.location}` : ''}${aspectStr} [Date: ${formatInTimeZone(startDate, state.timezone, 'yyyy-MM-dd')}] (ID: ${e.id})`;
          }).join('\n')}`
        : `\n\nUSER'S CALENDAR: No events found`;

      // Load user tasks for context
      let userTasks: any[] = [];
      if (state.userTasks && state.userTasks.length > 0) {
        userTasks = state.userTasks;
        console.log(`Using ${userTasks.length} pre-loaded tasks for context`);
      }

      const taskContext = userTasks.length > 0
        ? `\n\nUSER'S TASKS (${userTasks.length} total):\n${userTasks.map((t, idx) => {
            const dueStr = t.due_date ? ` (Due: ${formatInTimeZone(toDate(t.due_date), state.timezone, 'EEE, MMM d')})` : '';
            const priorityStr = t.priority ? ` [${t.priority.toUpperCase()}]` : '';
            const statusStr = t.status === 'completed' ? ' [done]' : t.status === 'in_progress' ? ' [in progress]' : '';
            const aspectStr = t.aspect ? ` {${t.aspect}}` : '';
            return `${idx + 1}. ${t.title}${priorityStr}${dueStr}${statusStr}${aspectStr} (ID: ${t.id})`;
          }).join('\n')}`
        : `\n\nUSER'S TASKS: No tasks found`;

      // Load user goals for context
      let userGoals: any[] = [];
      if (state.userGoals && state.userGoals.length > 0) {
        userGoals = state.userGoals;
        console.log(`Using ${userGoals.length} pre-loaded goals for context`);
      }

      const goalContext = userGoals.length > 0
        ? `\n\nUSER'S GOALS (${userGoals.length} total):\n${userGoals.map((g, idx) => {
            const targetStr = g.target_date ? ` (Target: ${formatInTimeZone(toDate(g.target_date), state.timezone, 'MMM d, yyyy')})` : '';
            const progressStr = g.progress !== null && g.progress !== undefined ? ` - ${g.progress}% complete` : '';
            const statusStr = g.status ? ` [${g.status.toUpperCase()}]` : '';
            const aspectStr = g.aspect ? ` (${g.aspect})` : '';
            return `${idx + 1}. ${g.title}${statusStr}${progressStr}${targetStr}${aspectStr} (ID: ${g.id})`;
          }).join('\n')}`
        : `\n\nUSER'S GOALS: No goals set`;

      // Log the actual goal context being sent to the LLM
      console.log(`[GOAL CONTEXT] ${goalContext}`);

      // Load Zep thread context using built-in API
      // This returns Zep's pre-formatted context block with user summary + relevant facts
      let zepThreadContext = '';
      try {
        // Ensure thread exists in Zep before retrieving context
        const threadId = await this.zepService.getOrCreateSession(state.userId);
        zepThreadContext = await this.zepService.getThreadContext(threadId);
        if (zepThreadContext) {
          console.log(`[CONVERSATION AGENT] Zep context loaded for thread ${threadId}`);
        } else {
          console.log(`[CONVERSATION AGENT] No Zep context found for thread`);
        }
      } catch (error) {
        console.error('Error loading Zep context:', error);
      }

      // Load ALL user rules (enabled and disabled) for context injection
      // This allows the agent to see disabled rules and re-enable them instead of creating duplicates
      let rulesContext = '';
      try {
        const userRules = await ruleService.getRules(state.userId);
        if (userRules.length > 0) {
          rulesContext = ruleService.formatRulesForPrompt(userRules);
          const enabledCount = userRules.filter(r => r.enabled).length;
          const disabledCount = userRules.length - enabledCount;
          console.log(`[CONVERSATION AGENT] Loaded ${userRules.length} rules (${enabledCount} enabled, ${disabledCount} disabled)`);
        } else {
          console.log(`[CONVERSATION AGENT] No rules found for user`);
        }
      } catch (error) {
        console.error('Error loading user rules:', error);
      }

      // Calculate temporal context IN USER'S TIMEZONE (critical for correct "tomorrow" interpretation)
      // Get current UTC time
      const nowUtc = new Date();

      // Format dates directly in user's timezone (this is the correct way)
      const todayFormatted = formatInTimeZone(nowUtc, state.timezone, 'yyyy-MM-dd');
      const tomorrowDayName = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'EEEE');
      const tomorrowFormatted = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'yyyy-MM-dd');

      // Build system prompt from extracted function (was 200+ lines inline)
      // Pass tool count from ToolRegistry for dynamic prompt generation
      // Include Zep's pre-formatted context block with user summary and relevant facts
      // Include user rules for behavioral guidance
      // Include aspects, profile, and recent activity for context awareness
      // Build location context string from live coords + resolved address
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
        toolCount: tools.length,
        zepGraphContext: zepThreadContext, // Use Zep's built-in context block
        rulesContext, // User's custom rules
        userAspects: state.userAspects, // Available aspects with IDs
        userProjects: state.userProjects, // Active projects with IDs
        userProfile: state.userProfile, // User profile with preferences
        recentUserActivity: state.recentUserActivity, // Recent manual changes
        recentAgentActivity: state.recentAgentActivity, // Recent agent actions
        currentPage: state.currentPage, // Current page user is viewing
        messageCount: state.messages.length, // Conversation stage awareness
        currentLocation: locationContext, // User's GPS coordinates
        ratingContext: state.ratingSummary?.length ? this.buildRatingContext(state.ratingSummary) : undefined,
        userFriends: state.userFriends, // User's friends list
      });


      const messages = [systemMessage, ...state.messages];

      console.log(`[AGENT NODE] Invoking model with ${messages.length} messages (${state.messages.length} state messages)`);
      const response = await modelWithTools.invoke(messages);
      console.log(`[AGENT NODE] Model response type: ${response._getType()}`);
      console.log(`[AGENT NODE] Model response has tool_calls: ${(response as any).tool_calls ? (response as any).tool_calls.length : 0}`);
      if ((response as any).tool_calls && (response as any).tool_calls.length > 0) {
        console.log(`[AGENT NODE] Tool calls requested:`, (response as any).tool_calls.map((t: any) => ({ name: t.name || t.tool, args: t.args })));
      } else {
        console.log(`[AGENT NODE] Model response content:`, response.content);
      }

      return {
        messages: [response],
      };
    };

    const executeTools = async (state: ConversationStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      console.log(`[TOOLS NODE] Checking last message type: ${lastMessage._getType()}`);
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        console.log(`[TOOLS NODE] Found ${(lastMessage as any).tool_calls.length} tool calls to execute:`, (lastMessage as any).tool_calls.map((t: any) => t.name || t.tool));
        const toolResults = await toolNode.invoke(state, {
          configurable: {
            userId: state.userId,
            timezone: state.timezone
          }
        });
        console.log(`[TOOLS NODE] Tool execution completed, results:`, toolResults.messages);
        return {
          messages: toolResults.messages,
        };
      }
      console.log(`[TOOLS NODE] No tool calls found in message`);
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