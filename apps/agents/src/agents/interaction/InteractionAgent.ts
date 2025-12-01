import { StateGraph, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SupabaseService } from '../../services/SupabaseService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse } from '../../types/agents.js';
import { getCurrentTimeInTimezone } from '../../utils/timezoneUtils.js';
import { toDate, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { buildSystemPrompt } from './prompts.js';

// Define the state structure for the interaction agent
const InteractionState = Annotation.Root({
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
});

type InteractionStateType = typeof InteractionState.State;

export class InteractionAgent extends BaseAgent {
  private graph: any;

  constructor() {
    super('interaction', "gpt-4o-mini"); // Use gpt-4o-mini for interactions (faster, focused task)
    this.graph = this.createGraph();
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
  }

  async processMessage(context: AgentContext, message: string): Promise<AgentResponse> {
    try {
      // Load memory context using Zep
      const memoryContext = await this.loadMemoryContext(context, 'conversation');

      // Pre-load user events for context
      const supabaseService = new SupabaseService();

      // Get user profile to fetch timezone
      const userProfile = await supabaseService.getProfile(context.userId);
      const userTimezone = userProfile?.timezone || context.timezone || 'UTC';

      if (!userProfile?.timezone) {
        console.warn(`[INTERACTION AGENT] User profile missing timezone, falling back to ${userTimezone}`);
      }

      console.log(`[INTERACTION AGENT] Using user timezone: ${userTimezone}`);

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

      // Invoke LangGraph with enhanced context
      const result = await this.graph.invoke({
        messages: messages,
        userId: context.userId,
        timezone: userTimezone,
        userEvents: userEvents || [],
        userTasks: userTasks || [],
      }, {
        recursionLimit: 4  // Max 4 steps: agent -> tools -> agent -> end (prevents excessive looping)
      });

      // Get the last AI message
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];

      let response = lastAiMessage?.content || "Interaction processed successfully.";

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
        content: "Sorry, I encountered an error processing your interaction. Please try again.",
        type: 'text'
      };
    }
  }

  getSystemPrompt(): string {
    // This method is required by BaseAgent abstract class but is not used.
    // The actual system prompt is built dynamically in createGraph() using buildSystemPrompt() from prompts.ts
    // which includes runtime context like user events, tasks, and timezone.
    return "UNUSED - See buildSystemPrompt in prompts.ts";
  }

  getCapabilities(): string[] {
    return [
      "Generate proactive suggestions",
      "Create interactive prompts",
      "Execute metadata-driven actions",
      "Handle flexible user responses",
      "Create events and tasks from interactions"
    ];
  }

  private createGraph(): any {
    // Get restricted tool set for InteractionAgent (NO action tools)
    // InteractionAgent should only suggest interactions and query state, never take direct action
    const toolRegistry = ToolRegistry.getInstance();
    const tools = toolRegistry.getInteractionAgentTools();
    const toolNode = new ToolNode(tools);

    // Bind tools to the model
    const modelWithTools = this.model.bindTools(tools);

    // Register tools with the base agent
    this.registerTools(tools);

    console.log(`🔧 [INTERACTION AGENT] Loaded ${tools.length} tools from ToolRegistry (restricted set - suggestions only)`);

    // Define the workflow nodes
    const callModel = async (state: InteractionStateType) => {
      // Use pre-loaded events (already filtered to future/ongoing in processMessage)
      let recentEvents: any[] = [];

      if (state.userEvents && state.userEvents.length > 0) {
        recentEvents = state.userEvents;
        console.log(`Using ${recentEvents.length} pre-loaded events for context`);
      }

      const eventContext = recentEvents.length > 0
        ? `\n\nUSER'S CALENDAR (next few days):\n${recentEvents.map((e) => {
            const startDate = toDate(e.start_time);
            const endDate = toDate(e.end_time);
            const dateStr = formatInTimeZone(startDate, state.timezone, 'EEE, MMM d');
            const startTime = formatInTimeZone(startDate, state.timezone, 'h:mm a');
            const endTime = formatInTimeZone(endDate, state.timezone, 'h:mm a');
            return `- "${e.title}" on ${dateStr} from ${startTime} to ${endTime}${e.location ? ` at ${e.location}` : ''}`;
          }).join('\n')}`
        : `\n\nUSER'S CALENDAR: No events found`;

      // Filter tasks to only show pending/in-progress (not completed)
      let pendingTasks: any[] = [];
      if (state.userTasks && state.userTasks.length > 0) {
        pendingTasks = state.userTasks.filter(t => t.status !== 'completed');
        console.log(`Using ${pendingTasks.length} pending tasks for context (filtered from ${state.userTasks.length} total)`);
      }

      const taskContext = pendingTasks.length > 0
        ? `\n\nPENDING TASKS:\n${pendingTasks.map((t, idx) => {
            const dueStr = t.due_date ? ` (Due: ${formatInTimeZone(toDate(t.due_date), state.timezone, 'MMM d')})` : '';
            const priorityStr = t.priority ? ` [${t.priority.toUpperCase()}]` : '';
            return `${idx + 1}. ${t.title}${priorityStr}${dueStr}`;
          }).join('\n')}`
        : `\n\nPENDING TASKS: None`;

      // Calculate temporal context
      const nowUtc = new Date();
      const todayFormatted = formatInTimeZone(nowUtc, state.timezone, 'yyyy-MM-dd');
      const tomorrowDayName = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'EEEE');
      const tomorrowFormatted = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'yyyy-MM-dd');

      // Build system prompt
      const systemMessage = buildSystemPrompt({
        timezone: state.timezone,
        eventContext,
        taskContext,
        todayFormatted,
        tomorrowFormatted,
        tomorrowDayName,
        toolCount: tools.length,
      });

      const messages = [systemMessage, ...state.messages];

      console.log(`[INTERACTION AGENT] Invoking model with ${messages.length} messages`);
      const response = await modelWithTools.invoke(messages);
      console.log(`[INTERACTION AGENT] Model response type: ${response._getType()}`);
      console.log(`[INTERACTION AGENT] Model response has tool_calls: ${(response as any).tool_calls ? (response as any).tool_calls.length : 0}`);

      return {
        messages: [response],
      };
    };

    const executeTools = async (state: InteractionStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      console.log(`[INTERACTION AGENT TOOLS] Checking last message type: ${lastMessage._getType()}`);
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        console.log(`[INTERACTION AGENT TOOLS] Found ${(lastMessage as any).tool_calls.length} tool calls to execute`);
        const toolResults = await toolNode.invoke(state, {
          configurable: {
            userId: state.userId,
            timezone: state.timezone
          }
        });
        console.log(`[INTERACTION AGENT TOOLS] Tool execution completed`);
        return {
          messages: toolResults.messages,
        };
      }
      console.log(`[INTERACTION AGENT TOOLS] No tool calls found in message`);
      return {};
    };

    // Determine if we should continue to tools or finish
    const shouldContinue = (state: InteractionStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        return "tools";
      }
      return "__end__";
    };

    // Build the graph
    const workflow = new StateGraph(InteractionState)
      .addNode("agent", callModel)
      .addNode("tools", executeTools)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue, {
        tools: "tools",
        "__end__": "__end__"
      })
      .addEdge("tools", "agent");

    return workflow.compile();
  }
}
