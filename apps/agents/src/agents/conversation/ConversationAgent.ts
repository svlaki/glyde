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
import { toDate } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { createEventTool } from '../../tools/calendar/create-event.js';
import { updateEventTool } from '../../tools/calendar/update-event.js';
import { deleteEventTool } from '../../tools/calendar/delete-event.js';
import { deleteMultipleEventsTool } from '../../tools/calendar/delete-multiple-events.js';
import { searchEventsTool } from '../../tools/calendar/search-events.js';
import { listEventsTool } from '../../tools/calendar/list-events.js';
import { createTaskTool, updateTaskTool, deleteTaskTool, listTasksTool, completeTaskTool } from '../../tools/tasks/index.js';
import { createGoalTool, updateGoalTool, listGoalsTool, checkInGoalTool } from '../../tools/goals/index.js';
import { getProfileTool, updateProfileTool } from '../../tools/profile/index.js';
import { createCategoryTool, listCategoriesTool } from '../../tools/categories/index.js';

// Utility functions

// Helper function to format date for comparison using local timezone
function formatDateForComparison(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
});

type ConversationStateType = typeof ConversationState.State;

export class ConversationAgent extends BaseAgent {
  private graph: any;

  constructor() {
    super('conversation', "gpt-4o"); // Use GPT-4 for better intelligence
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
        console.warn(`⚠️ [CONVERSATION AGENT] User profile missing timezone, falling back to ${userTimezone}`);
      }

      console.log(`🌍 [CONVERSATION AGENT] Using user timezone: ${userTimezone}`);

      // Get events as UTC - we'll format them for display in the agent prompt
      const userEvents = await supabaseService.getEvents(context.userId);
      console.log(`Loading ${userEvents?.length || 0} events (UTC) for user ${context.userId}`);

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
      
      // Invoke LangGraph with enhanced context including proper timezone
      const result = await this.graph.invoke({
        messages: messages,
        userId: context.userId,
        timezone: userTimezone, // Use resolved timezone from profile, context, or UTC fallback
        userEvents: userEvents || [],
        userTasks: userTasks || [],
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

      // Persist conversation to Graphiti memory
      try {
        await this.persistConversationToMemory(context, message, response);
      } catch (error) {
        console.warn('Failed to persist conversation to memory:', error);
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
    return "You are a helpful personal assistant that helps users manage their calendar and tasks through natural language commands.";
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

  private createGraph(): any {
    // Define tools for calendar and task operations
    // Calendar tools are imported from tools/calendar/ directory

    const searchMemoryTool = tool(
      async ({ query, contextType }) => {
        return `Memory search parameters: ${JSON.stringify({ query, contextType })}`;
      },
      {
        name: "search_memory",
        description: "Search user's long-term memory and behavioral patterns using Zep memory service. Use this to understand user preferences, habits, goals, and past experiences relevant to current conversation.",
        schema: z.object({
          query: z.string().describe("Search query for user's memory (e.g., 'work habits', 'meeting preferences', 'productivity patterns', 'goal progress')"),
          contextType: z.enum(["conversation", "task_planning", "goal_coaching"]).nullable().describe("Type of context to search (defaults to 'conversation')"),
        }),
      }
    );

    const tools = [
      // Core calendar operations
      createEventTool,
      updateEventTool,
      deleteEventTool,
      deleteMultipleEventsTool,
      searchEventsTool,
      listEventsTool,

      // Task management
      createTaskTool,
      updateTaskTool,
      deleteTaskTool,
      listTasksTool,
      completeTaskTool,

      // Goal management
      createGoalTool,
      updateGoalTool,
      listGoalsTool,
      checkInGoalTool,

      // User profile
      getProfileTool,
      updateProfileTool,

      // Category management
      createCategoryTool,
      listCategoriesTool,

      // Memory search
      searchMemoryTool
    ];
    const toolNode = new ToolNode(tools);

    // Bind tools to the model
    const modelWithTools = this.model.bindTools(tools);
    
    // Register tools with the base agent
    this.registerTools(tools);

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
          const eventsData = await supabaseService.getEventsForAgent(state.userId);
          
          if (eventsData && eventsData.length > 0) {
            recentEvents = eventsData;
            console.log(`Found ${recentEvents.length} events for user context`);
          } else {
            console.log('No events found for user context');
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

            return `- "${e.title}" on ${dateStr} (${timeOfDay}) from ${startTime} to ${endTime}${e.location ? ` at ${e.location}` : ''} [Date: ${formatInTimeZone(startDate, state.timezone, 'yyyy-MM-dd')}]`;
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
            return `${idx + 1}. ${t.title}${priorityStr}${dueStr}${statusStr}`;
          }).join('\n')}`
        : `\n\nUSER'S TASKS: No tasks found`;

      // Calculate temporal context for better understanding
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(now);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      
      const systemMessage = new SystemMessage(`You are a friendly personal calendar and task assistant. Help users manage their time and tasks naturally and conversationally.

YOUR CALENDAR:${eventContext}

YOUR TASKS:${taskContext}

TIME CONTEXT:
- Now: ${getCurrentTimeInTimezone(state.timezone)}
- Today: ${formatDateForComparison(now)}
- Tomorrow: ${formatDateForComparison(tomorrow)} (${formatInTimeZone(tomorrow, state.timezone, 'EEEE')})

COMMUNICATION:
- Be warm and conversational, not robotic
- Use natural language: "Got it!", "Let me add that", "I see you have..."
- When creating/updating/deleting, explain briefly what you're doing
- Ask for missing info (time, duration, location) when needed
- Proactively mention conflicts and suggest alternatives

INTELLIGENT CONTEXT FILTERING:
When showing events, filter based on user's intent:
- "What's coming up?" → Next 7 days
- "Today's schedule" → Today only
- "Tomorrow" → Tomorrow only
- "This week" → Current week
- "Next week" → 7-14 days out

TEMPORAL PARSING:
- "tomorrow morning/afternoon/evening" → 8-12pm / 12-5pm / 5-9pm
- "next [day]" → next occurrence of that weekday
- "this weekend" → upcoming Sat/Sun
- All times are LOCAL timezone, never UTC

EVENT CREATION:
- Ask for time if not specified
- Default to 1 hour duration
- Parse natural language: "2pm tomorrow", "lunch Tuesday", "5pm"
- Auto-assign to appropriate category (Work, Social, Fitness, Shopping, Health, etc.)
- Create new categories when users mention new activity types
- Conflicts detected automatically - suggest alternatives

CRITICAL TIMEZONE:
- User times are LOCAL: "5pm" = 5pm local, not UTC
- Format timestamps: "2025-08-26T15:00:00.000" (NO .000Z suffix)

TOOL SELECTION (CRITICAL - FOLLOW EXACTLY):
- DELETE specific event → ALWAYS use delete_event with searchQuery DIRECTLY (has built-in search)
  Example: "delete cs 221" → delete_event(searchQuery="cs 221")
  DO NOT search_events first, delete_event will find it
- Delete all on date → delete_multiple_events with date
- Clear calendar → delete_multiple_events with searchQuery "*"
- UPDATE event → update_event (supports category changes)
- SEARCH/FIND events → search_events with text/category (for viewing only)
- List range → list_events with dates

CATEGORIES:
Work, School, Health & Hygiene, Social, Family, Personal, Fitness, Hobbies, Finance, Shopping, Travel, Self-Care

TASK MANAGEMENT:
- When users mention "task", "todo", or "need to", use create_task
- ALWAYS assign appropriate category based on task nature (Work, School, Health & Hygiene, Shopping, Finance, etc.)
- Ask for due date if important ("when do you need this done?")
- Default to 'medium' priority unless user specifies
- List existing tasks when user asks "what do I need to do?" or similar
- Mark tasks complete when user says they finished something
- Update task details (due date, priority, category) when user asks

Use tools proactively. When user wants multiple events or tasks, create them all using the appropriate tools multiple times.`);

      const messages = [systemMessage, ...state.messages];
      
      const response = await modelWithTools.invoke(messages);
      
      return {
        messages: [response],
      };
    };

    const executeTools = async (state: ConversationStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        const toolResults = await toolNode.invoke(state, {
          configurable: {
            userId: state.userId,
            timezone: state.timezone
          }
        });
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