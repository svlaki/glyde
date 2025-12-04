import { StateGraph, Annotation } from "@langchain/langgraph";
// ChatOpenAI is imported by BaseAgent
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from '../../services/SupabaseService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { getCurrentTimeInTimezone } from '../../utils/timezoneUtils.js';
import { toDate, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { buildSystemPrompt } from './prompts.js';

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
      
      // Pre-load user events for LangGraph context (still needed for immediate calendar operations)
      const supabaseService = new SupabaseService();
      
      // Get user profile to fetch timezone
      const userProfile = await supabaseService.getProfile(context.userId);
      const userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      if (!userProfile?.timezone) {
        console.warn(`[CONVERSATION AGENT] User profile missing timezone, falling back to ${userTimezone}`);
      }

      console.log(`[CONVERSATION AGENT] Using user timezone: ${userTimezone}`);

      // Add current message to Zep BEFORE context retrieval so it's included in context
      try {
        await this.zepService.addUserMessage(context.userId, message);
      } catch (error) {
        console.warn('Failed to add user message to Zep:', error);
      }

      // Get events as UTC - we'll format them for display in the agent prompt
      // Filter to only include events that haven't ended yet (including ongoing multi-day events)
      const now = new Date();
      const allEvents = await supabaseService.getEvents(context.userId);
      const userEvents = allEvents.filter(event => new Date(event.end_time) >= now);
      console.log(`Loading ${userEvents?.length || 0} future/ongoing events (filtered from ${allEvents?.length || 0} total) for user ${context.userId}`);

      // Get user tasks
      const userTasks = await supabaseService.getTasks(context.userId);
      console.log(`Loading ${userTasks?.length || 0} tasks for user ${context.userId}`);

      // Get user goals
      const userGoals = await supabaseService.getGoals(context.userId);
      console.log(`Loading ${userGoals?.length || 0} goals for user ${context.userId}`);

      // Build conversation history from context
      const messages: BaseMessage[] = [];
      
      // Add conversation history if available
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        // Keep last 10 messages for context (5 exchanges)
        const recentHistory = context.conversationHistory.slice(-10);
        for (const msg of recentHistory) {
          // Ensure content is a string
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          
          if (msg.role === 'user') {
            messages.push(new HumanMessage(content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(content));
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
        // Add Graphiti memory context
        memoryContext: memoryContext.graphiti ? {
          userNodeUuid: memoryContext.graphiti.userNodeUuid,
          relevantFacts: memoryContext.graphiti.relevantFacts.map(f => f.fact).join('\n- '),
          totalFacts: memoryContext.graphiti.totalFacts
        } : null
      });

      // Get the last AI message
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];

      let response = lastAiMessage?.content || "Let me work on that for you...";

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
- Do NOT suggest or create category names with emojis
- Keep all responses and category names plain text without emoji characters
- When processing categories, remove any emoji characters if provided by the user`;
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
   */
  async *streamMessage(context: AgentContext, message: string): AsyncGenerator<{
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
      const [memoryContext, userProfile, allEvents, userTasks] = await Promise.all([
        this.loadMemoryContext(context, 'conversation'),
        supabaseService.getProfile(context.userId),
        supabaseService.getEvents(context.userId),
        supabaseService.getTasks(context.userId),
      ]);

      const userTimezone = userProfile?.timezone || context.timezone || 'UTC';
      console.log(`🌊 [CONVERSATION AGENT] Streaming with timezone: ${userTimezone}`);

      // Filter to only include events that haven't ended yet
      const now = new Date();
      const userEvents = allEvents.filter(event => new Date(event.end_time) >= now);

      // Build conversation history from context
      const messages: BaseMessage[] = [];

      // Add conversation history if available
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        // Keep last 10 messages for context (5 exchanges)
        const recentHistory = context.conversationHistory.slice(-10);
        for (const msg of recentHistory) {
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

          if (msg.role === 'user') {
            messages.push(new HumanMessage(content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(content));
          }
        }
      }

      // Add the current message
      messages.push(new HumanMessage(message));

      // Build initial state
      const initialState = {
        messages: messages,
        userId: context.userId,
        timezone: userTimezone,
        userEvents: userEvents || [],
        userTasks: userTasks || [],
        memoryContext: memoryContext.graphiti ? {
          userNodeUuid: memoryContext.graphiti.userNodeUuid,
          relevantFacts: memoryContext.graphiti.relevantFacts.map(f => f.fact).join('\n- '),
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

      for await (const event of eventStream) {
        // Handle text streaming from the model
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data?.chunk;
          if (chunk && chunk.content && typeof chunk.content === 'string') {
            fullResponse += chunk.content;
            yield { type: 'text-delta', content: chunk.content };
          }
        }

        // Handle tool execution start
        else if (event.event === 'on_tool_start') {
          console.log(`🔧 [STREAM] Tool starting: ${event.name}`);
          yield { type: 'tool-start', toolName: event.name };
        }

        // Handle tool execution end
        else if (event.event === 'on_tool_end') {
          console.log(`✅ [STREAM] Tool completed: ${event.name}`);
          yield { type: 'tool-end', toolName: event.name, toolResult: event.data?.output };
        }
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

            const categoryStr = e.category ? ` [${e.category}]` : '';
            return `- "${e.title}" on ${dateStr} (${timeOfDay}) from ${startTime} to ${endTime}${e.location ? ` at ${e.location}` : ''}${categoryStr} [Date: ${formatInTimeZone(startDate, state.timezone, 'yyyy-MM-dd')}] (ID: ${e.id})`;
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
            const statusStr = t.status === 'completed' ? ' ✓' : t.status === 'in_progress' ? ' 🔄' : '';
            const categoryStr = t.category ? ` {${t.category}}` : '';
            return `${idx + 1}. ${t.title}${priorityStr}${dueStr}${statusStr}${categoryStr} (ID: ${t.id})`;
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
            const categoryStr = g.category ? ` (${g.category})` : '';
            return `${idx + 1}. ${g.title}${statusStr}${progressStr}${targetStr}${categoryStr} (ID: ${g.id})`;
          }).join('\n')}`
        : `\n\nUSER'S GOALS: No goals set`;

      // Log the actual goal context being sent to the LLM
      console.log(`📊 [GOAL CONTEXT] ${goalContext}`);

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
      const systemMessage = buildSystemPrompt({
        timezone: state.timezone,
        eventContext,
        taskContext,
        goalContext,
        todayFormatted,
        tomorrowFormatted,
        tomorrowDayName,
        toolCount: tools.length,
        zepGraphContext: zepThreadContext // Use Zep's built-in context block
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