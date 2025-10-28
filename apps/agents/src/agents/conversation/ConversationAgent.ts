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
import { createEventTool } from '../../tools/calendar/create-event.js';
import { updateEventTool } from '../../tools/calendar/update-event.js';
import { deleteEventTool } from '../../tools/calendar/delete-event.js';
import { deleteMultipleEventsTool } from '../../tools/calendar/delete-multiple-events.js';
import { bulkUpdateEventsTool } from '../../tools/calendar/bulk-update-events.js';
import { searchEventsTool } from '../../tools/calendar/search-events.js';
import { listEventsTool } from '../../tools/calendar/list-events.js';
import { createTaskTool, updateTaskTool, deleteTaskTool, listTasksTool, completeTaskTool } from '../../tools/tasks/index.js';
import { createGoalTool, updateGoalTool, listGoalsTool, checkInGoalTool } from '../../tools/goals/index.js';
import { getProfileTool, updateProfileTool } from '../../tools/profile/index.js';
import { createCategoryTool, listCategoriesTool } from '../../tools/categories/index.js';
import { webSearchTool } from '../../tools/search/index.js';

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
      bulkUpdateEventsTool,
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
      searchMemoryTool,

      // Web search
      webSearchTool
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

      // Calculate temporal context IN USER'S TIMEZONE (critical for correct "tomorrow" interpretation)
      // Get current UTC time
      const nowUtc = new Date();

      // Format dates directly in user's timezone (this is the correct way)
      const todayFormatted = formatInTimeZone(nowUtc, state.timezone, 'yyyy-MM-dd');
      const tomorrowDayName = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'EEEE');
      const tomorrowFormatted = formatInTimeZone(addDays(nowUtc, 1), state.timezone, 'yyyy-MM-dd');

      const systemMessage = new SystemMessage(`You are a friendly personal calendar and task assistant. Help users manage their time and tasks naturally and conversationally.

YOUR CALENDAR:${eventContext}

YOUR TASKS:${taskContext}

TIME CONTEXT (USER'S TIMEZONE: ${state.timezone}):
- Current time: ${getCurrentTimeInTimezone(state.timezone)}
- Today's date: ${todayFormatted}
- Tomorrow's date: ${tomorrowFormatted} (${tomorrowDayName})
- User timezone: ${state.timezone}

CRITICAL TEMPORAL RULES:
- When user says "tomorrow", they mean ${tomorrowFormatted} in their timezone (${state.timezone})
- When user says "today", they mean ${todayFormatted} in their timezone
- ALWAYS create timestamps in user's LOCAL timezone, never UTC
- Example: "tomorrow at 7pm" = "${tomorrowFormatted}T19:00:00" (no Z suffix!)

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

TEMPORAL PARSING EXAMPLES:
- "tomorrow morning" → ${tomorrowFormatted}T09:00:00 (9am local time)
- "tomorrow afternoon" → ${tomorrowFormatted}T14:00:00 (2pm local time)
- "tomorrow at 7pm" → ${tomorrowFormatted}T19:00:00 (7pm local time)
- "today at 3pm" → ${todayFormatted}T15:00:00 (3pm local time)
- "next [day]" → next occurrence of that weekday in user's timezone
- "this weekend" → upcoming Sat/Sun in user's timezone
- NEVER add 'Z' suffix to timestamps (that means UTC!)
- NEVER use UTC dates - always use dates shown above in TIME CONTEXT

CRITICAL: WHEN TO CREATE EVENT vs TASK vs GOAL

CREATE EVENT when:
✅ Has a SPECIFIC TIME (e.g., "meeting at 3pm", "dentist appointment Tuesday 2pm", "lunch at noon")
✅ Time-bound activity (e.g., "class from 2-4pm", "gym session 6-7pm")
✅ Appointment, meeting, or scheduled activity
✅ Examples: meetings, appointments, classes, events, parties, calls

CREATE TASK when:
✅ NO specific time mentioned (e.g., "I need to buy groceries", "study for exam", "call mom")
✅ Todo item or action to complete
✅ Has a deadline but no specific start time (e.g., "submit report by Friday")
✅ Flexible timing - can be done anytime
✅ Examples: errands, homework, chores, emails to send, things to buy

CREATE GOAL when:
✅ Long-term objective or aspiration (e.g., "learn Spanish", "lose 20 pounds", "read 50 books")
✅ Has milestones or sub-goals
✅ Ongoing progress tracking needed
✅ Examples: fitness goals, learning goals, career goals, personal development

DEFAULT DECISION TREE:
1. Does it have a SPECIFIC TIME? → EVENT
2. Is it a todo/action item? → TASK
3. Is it a long-term objective? → GOAL

EVENT CREATION:
- Ask for time if not specified
- Default to 1 hour duration
- Parse natural language: "2pm tomorrow", "lunch Tuesday", "5pm"
- ALWAYS call list_categories FIRST to see what categories exist
- Create new categories for specific entities (individual classes, projects, clients)
- Use existing categories only when they accurately describe the activity
- Conflicts detected automatically - suggest alternatives

CRITICAL TIMEZONE:
- User times are LOCAL: "5pm" = 5pm local, not UTC
- Format timestamps: "2025-08-26T15:00:00.000" (NO .000Z suffix)

TOOL SELECTION (CRITICAL - FOLLOW EXACTLY):
- DELETE specific event → ALWAYS use delete_event with searchQuery DIRECTLY (has built-in search)
  Example: "delete cs 221 event" → delete_event(searchQuery="cs 221")
  DO NOT search_events first, delete_event will find it
- DELETE specific task → ALWAYS use delete_task with searchQuery DIRECTLY (has built-in search)
  Example: "delete cs 221 task" → delete_task(searchQuery="cs 221")
  DO NOT list_tasks first, delete_task will find it
- Delete all on date → delete_multiple_events with date
- Clear calendar → delete_multiple_events with searchQuery "*"
- UPDATE event → update_event (supports category changes)
- SEARCH/FIND events → search_events with text/category (for viewing only)
- List range → list_events with dates

CRITICAL: REPLACING/RESCHEDULING EVENTS
When user wants to cancel an existing event and create a new one in its place:
- Use create_event with replaceConflicting=true
- This automatically deletes the conflicting event and creates the new one
- Examples:
  * "cancel rehearsal and schedule dinner" → create_event(replaceConflicting=true)
  * "move the meeting and add workout" → create_event(replaceConflicting=true)
  * "replace my 3pm with lunch" → create_event(replaceConflicting=true)

DO NOT use replaceConflicting=true if:
- User is just asking "when can I schedule X?" (they're not explicitly canceling)
- User says "find time for X" (they want available time, not to replace)
- No explicit intent to cancel/replace an existing event

If create_event returns "⚠️ Time conflict detected":
- The event was NOT created (important!)
- User needs to explicitly say they want to cancel/replace the conflicting event
- Don't assume - ask them: "You have [X] at that time. Would you like me to cancel it and schedule [Y] instead?"

CATEGORY WORKFLOW (CRITICAL):
1. ALWAYS call list_categories FIRST before creating events/tasks/goals
2. For SPECIFIC named entities → create SPECIFIC categories:
   - Classes: Create "CS173A", "PHIL 1" (NOT generic "School")
   - Projects: Create "Project Phoenix" (NOT "Work")
   - Clients: Create "Client Acme" (NOT "Work")
   - Recurring activities: Create "Weekly D&D" (NOT "Hobbies")
3. Use existing broad categories ONLY for truly generic activities
4. When uncertain → create specific category rather than force-fit into generic ones

CATEGORY EXAMPLES:
✅ "Add CS173A class Tuesday 1:30pm" → list_categories → create_category("CS173A") → create_event(category="CS173A")
✅ "Meeting for Project Phoenix" → list_categories → create_category("Project Phoenix") → create_event(category="Project Phoenix")
✅ "Workout at gym" → list_categories → use existing "Fitness" if available, or create "Gym"
❌ "Add CS173A class" → create_event(category="School") ← WRONG! Use specific category
❌ "Project Phoenix meeting" → create_event(category="Work") ← WRONG! Create specific category

TASK MANAGEMENT:
- When users mention "task", "todo", or "need to", use create_task
- ALWAYS assign appropriate category based on task nature (Work, School, Health & Hygiene, Shopping, Finance, etc.)
- Ask for due date if important ("when do you need this done?")
- Default to 'medium' priority unless user specifies
- List existing tasks when user asks "what do I need to do?" or similar
- Mark tasks complete when user says they finished something
- Update task details (due date, priority, category) when user asks

BULK CATEGORY UPDATES (CRITICAL):
When user asks to "move X to category Y" or "put all X in category Y" or "categorize X as Y":
1. Search for ALL matching items by TEXT CONTENT (DO NOT filter by category!):
   - Use search_events(query="X", category=null) to find events by title/description
   - Use list_tasks() with NO category filter, then filter response for "X" in title/description
   - Use list_goals() with NO category filter, then filter response for "X" in title/description
2. Update EVERY matching item with update_event/update_task/update_goal, passing the category parameter
3. Report back how many of each type were updated

Example: "move all mendicants things to mendicants category" should:
  → search_events(query="mendicants", category=null) → find by text → update ALL with category="Mendicants"
  → list_tasks() → filter for "mendicants" in title → update ALL with category="Mendicants"
  → list_goals() → filter for "mendicants" in title → update ALL with category="Mendicants"

CRITICAL: When searching for items to categorize, NEVER pass the destination category as a filter!
You're searching for UNcategorized items that CONTAIN the search term, not items already IN that category.

INTELLIGENT EVENT ENRICHMENT WITH WEB SEARCH:
When creating events with restaurants, venues, or locations mentioned:
1. Use web_search BEFORE creating the event to gather information:
   - Search for: "[venue name] [city] address hours contact"
   - Example: "Flour + Water San Francisco address hours phone"
2. Extract key details from search results:
   - Full street address for location field
   - Phone number and hours for description
   - Any relevant notes (parking, dress code, etc.)
3. Populate event with enriched information:
   - location: Full street address (not just venue name)
   - description: Include phone, hours, and useful notes
4. Proactively suggest useful additions:
   - Travel time buffer before the event
   - Parking information if relevant
   - Preparation reminders

WEB SEARCH USE CASES:
✅ USE web_search for:
- Restaurant/cafe details (address, hours, phone, menu)
- Venue information (locations, addresses, directions)
- Business information (hours, contact, services)
- Event details (sports games, concerts, showtimes)
- Current information user explicitly asks about
- Recommendations when user asks "what's a good..."

❌ DON'T use web_search for:
- User's personal calendar/task/goal data (use existing tools)
- Generic time/date calculations
- Simple event creation without venue details
- Information already available in conversation context

EXAMPLE WORKFLOW:
User: "Schedule dinner at Flour + Water tomorrow at 7pm"
1. web_search("Flour + Water San Francisco address hours phone")
2. Extract: Address, phone, hours from results
3. create_event({
     title: "Dinner at Flour + Water",
     start_time: "2025-10-28T19:00:00",
     end_time: "2025-10-28T21:00:00",
     location: "2401 Harrison St, San Francisco, CA 94110",
     description: "Italian restaurant • (415) 826-7000 • Hours: 5-10pm"
   })
4. Respond: "I've scheduled dinner at Flour + Water for tomorrow at 7pm at 2401 Harrison St. They're open until 10pm. Want me to add travel time?"

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