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
  pendingActions: Annotation<any[]>({
    reducer: (_existing, update) => update,
    default: () => [],
  }),
  lastResult: Annotation<string>({
    reducer: (_existing, update) => update,
    default: () => "",
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
      const userTimezone = userProfile?.timezone || 'America/New_York';
      console.log(`🌍 [CONVERSATION AGENT] Using user timezone: ${userTimezone}`);
      
      const userEvents = await supabaseService.getEventsForAgent(context.userId);
      console.log(`Loading ${userEvents?.length || 0} events for user ${context.userId}`);
      
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
        timezone: userTimezone, // Use timezone from user profile instead of context
        userEvents: userEvents || [],
        // Add Graphiti memory context
        memoryContext: memoryContext.graphiti ? {
          userNodeUuid: memoryContext.graphiti.userNodeUuid,
          relevantFacts: memoryContext.graphiti.relevantFacts.map(f => f.fact).join('\n- '),
          totalFacts: memoryContext.graphiti.totalFacts
        } : null
      });

      // Get the last AI message and any execution results
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      
      let response = lastAiMessage?.content || "Let me work on that for you...";
      
      if (result.lastResult) {
        response += `\n\n${result.lastResult}`;
      }

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
            // Parse the UTC time string correctly
            const startStr = e.event_starts_at || e.start_time;
            const endStr = e.event_ends_at || e.end_time;
            const start = new Date(startStr);
            const end = new Date(endStr);
            
            // Extract the UTC hour to determine time of day (events are stored in UTC)
            const utcHour = start.getUTCHours();
            const timeOfDay = utcHour < 12 ? 'morning' : utcHour < 17 ? 'afternoon' : 'evening';
            
            // Format the date and time (will use local timezone for display)
            const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
            const startTime = `${utcHour % 12 || 12}:${start.getUTCMinutes().toString().padStart(2, '0')} ${utcHour < 12 ? 'AM' : 'PM'}`;
            const endHour = end.getUTCHours();
            const endTime = `${endHour % 12 || 12}:${end.getUTCMinutes().toString().padStart(2, '0')} ${endHour < 12 ? 'AM' : 'PM'}`;
            
            return `- "${e.event_title || e.title}" on ${dateStr} (${timeOfDay}) from ${startTime} to ${endTime}${e.event_location || e.location ? ` at ${e.event_location || e.location}` : ''} [Date: ${start.toISOString().split('T')[0]}]`;
          }).join('\n')}`
        : `\n\nUSER'S CALENDAR: No events found`;

      // Calculate temporal context for better understanding
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(now);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      
      const systemMessage = new SystemMessage(`You are an intelligent personal calendar assistant with a warm, conversational personality. You help users manage their time effectively while communicating naturally and helpfully.

CRITICAL: Your user's complete calendar (ALL EVENTS):${eventContext}

CURRENT TIME CONTEXT:
- Right now: ${getCurrentTimeInTimezone(state.timezone || 'America/New_York')}
- Today's date: ${formatDateForComparison(now)}
- Tomorrow's date: ${formatDateForComparison(tomorrow)} (${tomorrow.toLocaleDateString('en-US', { weekday: 'long', timeZone: state.timezone || 'America/New_York' })})
- Day after tomorrow: ${formatDateForComparison(dayAfterTomorrow)} (${dayAfterTomorrow.toLocaleDateString('en-US', { weekday: 'long', timeZone: state.timezone || 'America/New_York' })})

COMMUNICATION STYLE - Be Natural & Conversational:
- Respond like a helpful friend, not a robot
- Use casual, warm language: "Sure thing!", "Got it!", "Let me check...", "Here's what I found..."
- NEVER say "I processed your request" or "Event created successfully" - that's robotic
- When you create something, just confirm naturally: "Added your meeting with John for Tuesday at 2pm"
- Be concise but friendly - don't over-explain unless asked
- Show personality: use appropriate enthusiasm, understanding, or gentle suggestions

CALENDAR INTERACTION RESPONSES:
- ALWAYS explain what you're doing BEFORE doing it: "Let me schedule that for you", "I'll add that to your calendar", "Setting up your grocery run"
- When creating events, be descriptive: "I'm adding 'Grocery shopping' to your calendar for today. I noticed you mentioned milk and bananas - I'll include those in the details"
- Ask for missing information: "What time would work best for your grocery run?", "How long do you think that will take?", "Where would you like to meet?"
- Be proactive about conflicts: "I see you have 'Meeting with John' at 2pm. Should I schedule this before or after?"
- When updating/deleting: "I've moved that meeting to 3pm", "Removed that grocery run from your schedule", "Updated with the new location"
- Engage with context: "Perfect! That gives you time for lunch before your 3pm call", "That works well - no conflicts with your existing schedule"
- Show you understand the request: "Got it - a workout session for tomorrow morning. I'll make sure to leave time for your usual routine."

INTELLIGENT EVENT FILTERING - Context Matters:
When users ask about their schedule, be smart about what you show:

- "What do I have coming up?" = Next 7 days only (filter out past events and events more than 1 week away)
- "What's my day like?" = Today's events only  
- "What's this week?" = Current week (Monday-Sunday)
- "Upcoming events" = Next 7 days, grouped by day
- "My schedule today" = Today only
- "Tomorrow's schedule" = Tomorrow only
- "Next week" = Following week (7-14 days from now)

ALWAYS filter and present events logically based on the user's question. Don't dump everything!

YOUR CAPABILITIES:
1. Answer calendar questions using intelligent filtering based on context
2. Create new events with natural language understanding and intelligent category assignment
3. Update and delete events (including category updates)
4. Find scheduling conflicts automatically during event creation
5. Search events by text or category
6. Create and manage tasks and goals
7. Manage categories - create new ones when users mention new types of activities
8. Search user's long-term memory and behavioral patterns using Zep memory service

IMPORTANT - When User Requests Multiple Events:
- If user says "schedule multiple events", "create several events", "add a bunch of events", "schedule a week of events", etc.
- You MUST use the create_event tool multiple times to create each event
- If user asks for "random events" for testing, create realistic sample events like:
  - Morning workouts, team meetings, lunch appointments
  - Project work sessions, doctor appointments, social events
  - Study time, family dinners, personal activities
- DO NOT just describe what you would schedule - ACTUALLY CREATE THE EVENTS using the create_event tool

TEMPORAL REFERENCE UNDERSTANDING:
When user mentions relative time references, interpret them as follows:
- "tomorrow morning" = tomorrow between 8am-12pm
- "tomorrow afternoon" = tomorrow between 12pm-5pm
- "tomorrow evening" = tomorrow between 5pm-9pm
- "tomorrow night" = tomorrow after 9pm
- "this morning/afternoon/evening" = today during those times
- "next Monday/Tuesday/etc" = the next occurrence of that day
- "next week" = 7-14 days from now
- "this week" = current week (Monday to Sunday)
- "this weekend" = upcoming Saturday and Sunday

WHEN ANSWERING CALENDAR QUESTIONS:
- ALWAYS look at the events context above first
- When user asks about "tomorrow morning meeting" or similar:
  1. Identify the date (tomorrow = ${formatDateForComparison(tomorrow)})
  2. Identify the time period (morning = 8am-12pm)
  3. Search for events matching BOTH criteria
  4. Be specific about which event you found
- If user asks "what's on my calendar", list the events you see
- If user asks about a specific day, filter events for that day
- If multiple events match the criteria, list them all

WHEN CREATING EVENTS:
- ALWAYS ask for clarification if the user doesn't specify a time
- Examples of when to ask: "I need to grab groceries today" → "What time works best for your grocery run?"
- Only schedule without asking if user gives specific time: "2pm tomorrow", "lunch next Tuesday"
- Parse natural language dates/times intelligently when provided
- "2pm tomorrow" = tomorrow at 14:00 LOCAL TIME
- "lunch next Tuesday" = next Tuesday at 12:00 LOCAL TIME  
- "5pm" means 5pm in user's timezone, NOT 5pm UTC
- Use 1 hour duration if not specified
- NEVER create events at times with conflicts - always suggest alternatives
- Be conversational: "I see you have 'X' at that time. How about 3pm instead?"
- Explain what you're doing: "Let me add that grocery run to your calendar" or "I'll schedule your workout"

INTELLIGENT CATEGORY ASSIGNMENT:
When creating events, tasks, or goals, intelligently assign them to appropriate categories:

**DEFAULT CATEGORIES AVAILABLE:**
- Work: Work-related activities, meetings, projects
- School: Classes, study sessions, assignments
- Health & Hygiene: Doctor appointments, dental visits, personal hygiene
- Social: Hangouts, parties, social gatherings
- Family: Family time, family events
- Personal: Personal errands, self-care activities
- Fitness: Workouts, gym, sports, exercise
- Hobbies: Creative pursuits, hobbies, leisure activities
- Finance: Banking, bill payments, financial planning
- Shopping: Grocery shopping, errands, purchases
- Travel: Trips, flights, vacations
- Self-Care: Meditation, relaxation, spa, personal time

**CATEGORY ASSIGNMENT GUIDELINES:**
1. Match events to the most appropriate existing category
2. If a category doesn't exist but would be useful, create it using create_category tool
3. Examples of category assignment:
   - "meeting with boss" → Work
   - "gym session" → Fitness
   - "doctor appointment" → Health & Hygiene
   - "grab groceries" → Shopping
   - "study for exam" → School
   - "dinner with friends" → Social
   - "meditation" → Self-Care
4. If user mentions a new type of activity not covered by existing categories, proactively create a new category

CRITICAL TIMEZONE HANDLING:
- User times are ALWAYS local time (e.g., "5pm" = 5pm local)
- Create ISO timestamps WITHOUT Z suffix: "2025-08-25T17:00:00.000" 
- NEVER use UTC indicators like .000Z - always use local time format
- Example: "schedule meeting at 3pm tomorrow" → "2025-08-26T15:00:00.000"

WHEN DELETING/UPDATING:
- Be careful and confirm the right event
- Use semantic search if user references event by description
- Support bulk operations like "delete all events tomorrow"

CRITICAL - Tool Selection Rules:
- "Delete all events tomorrow/today/Friday" → use delete_multiple_events with date
- "Delete any events tomorrow" → use delete_multiple_events with date  
- "Delete events on [date]" → use delete_multiple_events with date
- "Delete every event in my calendar" → use delete_multiple_events with searchQuery "*" (matches all)
- "Delete all my events" → use delete_multiple_events with searchQuery "*" (matches all)
- "Clear my calendar" → use delete_multiple_events with searchQuery "*" (matches all)
- "Delete everything" → use delete_multiple_events with searchQuery "*" (matches all)

IMPORTANT: When using delete_multiple_events with searchQuery "*", this will delete ALL events in the user's calendar. Only use this for explicit "delete everything" or "clear calendar" requests.

- "Delete [specific event name]" → use delete_event with searchQuery containing ONLY the event name
- "Get rid of [event name] tomorrow" → use delete_event with searchQuery "morning standup tomorrow"
- "Remove the [event name]" → use delete_event with searchQuery containing the event name
- "Delete my dinner party" → use delete_event with searchQuery "dinner party"
- "Delete the meeting about X" → use delete_event with searchQuery "meeting about X"
- "Delete that event" → use delete_event with eventId of most recently mentioned/created event
- "Delete it" → use delete_event with eventId of most recently mentioned/created event
- "Delete all of those" → use delete_multiple_events with searchQuery based on what was just shown/discussed
- "Can I delete all of those" → use delete_multiple_events with searchQuery based on what was just shown/discussed
- "Update my lunch meeting" → use update_event with searchQuery
- "Update that event" → use update_event with eventId of most recently mentioned/created event
- "Search for events about X" → use search_events
- "What events do I have Friday" → use list_events with date range
- "What does my workout schedule look like" → use search_events with "workout gym exercise fitness" query

IMPORTANT FOR DELETE: When user says "get rid of [event]" or "delete [event] tomorrow", pass the searchQuery with temporal context like "morning standup tomorrow" so the fallback search can find it.

CONTEXTUAL REFERENCES:
When user says "that event", "it", "the event", etc., refer to:
1. The most recently created event in this conversation
2. The most recently mentioned event by name
3. If unclear, ask for clarification instead of guessing

IMPORTANT: NEVER use partial UUIDs or truncated IDs. Only use full event IDs when provided explicitly.
For contextual references, use semantic search or date-based search instead of guessing IDs.

Your capabilities:
1. Create, update, delete, and search calendar events with intelligent category assignment
2. Detect and warn about scheduling conflicts
3. Parse natural language into structured actions
4. Create and manage tasks and goals with category assignment
5. Create new categories when users mention new types of activities
6. Search through user memory and context
7. ALWAYS use the most appropriate tool based on user intent

AVAILABLE TOOLS - Use These Tools Based on User Intent:

📅 CALENDAR MANAGEMENT:
- create_event: Create new calendar events with intelligent category assignment
- update_event: Modify existing events (supports category updates)
- delete_event: Remove a specific event
- delete_multiple_events: Remove multiple events by date or search criteria
- search_events: Find events by text or category
- list_events: List events in a specific date range

📋 TASK MANAGEMENT:
- create_task: Create new tasks with category assignment
- update_task: Update existing tasks
- list_tasks: List tasks with optional filters
- complete_task: Mark tasks as completed

🎯 GOAL MANAGEMENT:
- create_goal: Create new goals with category assignment
- update_goal: Update existing goals
- list_goals: List goals with optional filters
- check_in_goal: Record progress check-ins for goals

🏷️ CATEGORY MANAGEMENT:
- create_category: Create new categories for organizing events, tasks, and goals
- list_categories: List all available categories

🧠 MEMORY & CONTEXT:
- search_memory: Access user preferences, habits, goals, and past experiences
- Use when understanding user's scheduling patterns or behavioral insights

🚨 CONFLICT MANAGEMENT:
- When creating events, the create_event tool automatically checks for conflicts
- If conflicts are detected, suggest alternative times to the user
- Be conversational: "I see you have 'X' at that time. How about 3pm instead?"`);

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
          pendingActions: (lastMessage as any).tool_calls,
        };
      }
      return {};
    };

    const executeActualOperations = async (state: ConversationStateType) => {
      const results: string[] = [];
      
      for (const action of state.pendingActions) {
        try {
          let result: string;
          
          switch (action.name) {
            case "create_event":
              // Event creation is handled entirely by the tool
              // The tool returns its own success/error messages
              // No additional processing needed here
              continue;

            case "update_event":
              let eventId = action.args.eventId;
              
              // If no eventId provided, search for the event using Zep
              if (!eventId && action.args.searchQuery) {
                try {
                  // Use Zep memory service for intelligent event search
                  const searchMemoryResults = await this.zepService.searchMemory(
                    state.userId,
                    `calendar event ${action.args.searchQuery}`,
                    5
                  );

                  // Also search directly in database as fallback
                  const { SupabaseService } = await import('../../services/SupabaseService.js');
                  const supabaseService = new SupabaseService();
                  const events = await supabaseService.getEventsForAgent(state.userId);
                  const matchingEvents = events.filter((event: any) => {
                    const searchText = `${event.event_title} ${event.event_description || ''}`.toLowerCase();
                    return searchText.includes(action.args.searchQuery.toLowerCase());
                  });

                  if (matchingEvents.length > 0) {
                    eventId = matchingEvents[0].id;
                    result = `🔍 Found event: "${matchingEvents[0].event_title}" - updating...`;
                  } else {
                    // No matching events found
                    throw new Error('No matching events found');
                  }
                } catch (error) {
                  console.log('Semantic search failed for update, trying direct search:', error instanceof Error ? error.message : 'Unknown error');
                  
                  // Fallback to direct search
                  const searchLower = action.args.searchQuery.toLowerCase();
                  const supabaseService = new SupabaseService();
                  const allEvents = await supabaseService.getEventsForAgent(state.userId);
                  
                  const matchingEvent = allEvents.find((e: any) => {
                    const eventTitle = (e.event_title || e.title || '').toLowerCase();
                    const titleWords = eventTitle.split(' ');
                    const searchWords = searchLower.split(' ');
                    
                    // Check if any title word matches any search word
                    const titleMatch = titleWords.some((word: string) => searchWords.includes(word)) ||
                                      searchWords.some((word: string) => titleWords.includes(word)) ||
                                      searchLower.includes(eventTitle) || 
                                      eventTitle.includes(searchLower);
                    
                    // If search includes temporal context, check dates
                    if (searchLower.includes('tomorrow') || searchLower.includes('today')) {
                      const eventDate = formatDateForComparison(new Date(e.event_starts_at || e.start_time));
                      const today = new Date();
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const tomorrowStr = formatDateForComparison(tomorrow);
                      const todayStr = formatDateForComparison(today);
                      
                      if (searchLower.includes('tomorrow') && eventDate === tomorrowStr) {
                        return titleMatch;
                      } else if (searchLower.includes('today') && eventDate === todayStr) {
                        return titleMatch;
                      }
                      return false;
                    }
                    
                    return titleMatch;
                  });
                  
                  if (matchingEvent) {
                    eventId = matchingEvent.id;
                    result = `🔍 Found event: "${matchingEvent.event_title}" - updating...`;
                  } else {
                    result = `❌ No event found matching: "${action.args.searchQuery}"`;
                    break;
                  }
                }
              }
              
              if (eventId) {
                try {
                  // Build update object with only the fields that need updating
                  const updates: any = {};
                  if (action.args.title) updates.event_title = action.args.title;
                  if (action.args.startTime) updates.event_starts_at = action.args.startTime;
                  if (action.args.endTime) updates.event_ends_at = action.args.endTime;
                  if (action.args.location !== undefined) updates.event_location = action.args.location;
                  if (action.args.description !== undefined) updates.event_description = action.args.description;
                  
                  console.log(`Updating event ${eventId} with:`, updates);
                  
                  // Update event using SupabaseService
                  const supabaseService = new SupabaseService();
                  const success = await supabaseService.updateEvent(state.userId, eventId, updates);
                  
                  if (success) {
                    const updatedFields = Object.keys(updates).join(', ');
                    result = `Event updated successfully`;
                  } else {
                    result = `❌ Failed to update event`;
                  }
                } catch (error) {
                  console.error('Error updating event:', error);
                  result = `❌ Error updating event: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
              } else {
                result = `❌ No event ID provided and no search query given`;
              }
              break;

            case "delete_event":
              let deleteEventId = action.args.eventId;
              
              // Debug: Log delete event parameters if needed
              
              // If no eventId provided, search for the event using Zep
              if (!deleteEventId && action.args.searchQuery) {
                try {
                  // Use Zep memory service for intelligent event search
                  const searchMemoryResults = await this.zepService.searchMemory(
                    state.userId,
                    `calendar event ${action.args.searchQuery}`,
                    5
                  );

                  // Also search directly in database
                  const { SupabaseService } = await import('../../services/SupabaseService.js');
                  const supabaseService = new SupabaseService();
                  const events = await supabaseService.getEventsForAgent(state.userId);
                  const matchingEvents = events.filter((event: any) => {
                    const searchText = `${event.event_title} ${event.event_description || ''}`.toLowerCase();
                    return searchText.includes(action.args.searchQuery.toLowerCase());
                  });

                  if (matchingEvents.length > 0) {
                    deleteEventId = matchingEvents[0].id;
                    result = `🔍 Found event: "${matchingEvents[0].event_title}" - deleting...`;
                  } else {
                    // No matching events found
                    throw new Error('No matching events found');
                  }
                } catch (error) {
                  // If semantic search fails, try to find event by title and date
                  console.log('Semantic search failed, trying direct search:', error instanceof Error ? error.message : 'Unknown error');
                  console.log('Search query:', action.args.searchQuery);
                  
                  // Extract event title and date from search query
                  const searchLower = action.args.searchQuery.toLowerCase();
                  
                  // Try to find the event in the loaded events
                  const supabaseService = new SupabaseService();
                  const allEvents = await supabaseService.getEventsForAgent(state.userId);
                  console.log(`Found ${allEvents.length} events to search through`);
                  
                  // Find matching event by title (case insensitive) and optionally by date
                  const matchingEvent = allEvents.find((e: any) => {
                    const eventTitle = (e.event_title || e.title || '').toLowerCase();
                    const eventStartStr = e.event_starts_at || e.start_time;
                    console.log(`Checking event: "${eventTitle}" at ${eventStartStr}`);
                    
                    // Check if event title is in the search query or vice versa
                    const titleWords = eventTitle.split(' ');
                    const searchWords = searchLower.split(' ');
                    
                    // Check if any title word matches any search word
                    const titleMatch = titleWords.some((word: string) => searchWords.includes(word)) ||
                                      searchWords.some((word: string) => titleWords.includes(word)) ||
                                      searchLower.includes(eventTitle) || 
                                      eventTitle.includes('standup') && searchLower.includes('standup');
                    
                    if (!titleMatch) {
                      console.log(`  Title doesn't match`);
                      return false;
                    }
                    
                    // If search query includes a date, also match by date
                    if (searchLower.includes('2025-') || searchLower.includes('tomorrow') || searchLower.includes('today')) {
                      const eventDate = formatDateForComparison(new Date(eventStartStr));
                      const today = new Date();
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const tomorrowStr = formatDateForComparison(tomorrow);
                      const todayStr = formatDateForComparison(today);
                      
                      console.log(`  Event date: ${eventDate}, Tomorrow: ${tomorrowStr}, Today: ${todayStr}`);
                      
                      if (searchLower.includes('tomorrow') && eventDate === tomorrowStr) {
                        console.log(`  Matched as tomorrow's event!`);
                        return true;
                      } else if (searchLower.includes('today') && eventDate === todayStr) {
                        console.log(`  Matched as today's event!`);
                        return true;
                      } else if (searchLower.includes(eventDate)) {
                        console.log(`  Matched by date!`);
                        return true;
                      }
                      // If date mentioned but doesn't match, don't match this event
                      console.log(`  Date mentioned but doesn't match`);
                      return false;
                    }
                    
                    // No date specified, match by title only
                    console.log(`  Matched by title only!`);
                    return titleMatch;
                  });
                  
                  if (matchingEvent) {
                    deleteEventId = matchingEvent.id;
                    result = `🔍 Found event: "${matchingEvent.event_title}" - deleting...`;
                  } else {
                    result = `❌ No event found matching: "${action.args.searchQuery}"`;
                    break;
                  }
                }
              }
              
              if (deleteEventId) {
                try {
                  // Delete event using SupabaseService
                  console.log(`Attempting to delete event with ID: ${deleteEventId}`);
                  const supabaseService = new SupabaseService();
                  const success = await supabaseService.deleteEvent(state.userId, deleteEventId);
                  
                  if (success) {
                    result = `Event deleted successfully`;
                  } else {
                    result = `❌ Event not found or could not be deleted`;
                  }
                } catch (error) {
                  console.error('Error deleting event:', error);
                  result = `❌ Error deleting event: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
              } else {
                // No event ID or search query provided
                result = `❌ No event ID provided and no search query given`;
              }
              break;

            case "delete_multiple_events":
              let deletedCount = 0;
              let eventsToDelete: Array<{id: string, event_title: string, event_starts_at: string, event_ends_at: string}> = [];

              // Find events to delete
              if (action.args.date) {
                // Get all events on the specified date using SupabaseService
                const startDate = new Date(action.args.date);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 1);
                
                try {
                  const supabaseService = new SupabaseService();
                  const allEvents = await supabaseService.getEventsForAgent(state.userId);
                  
                  // Filter events for the specified date
                  eventsToDelete = allEvents.filter((e: any) => {
                    const eventDate = new Date(e.event_starts_at);
                    return eventDate >= startDate && eventDate < endDate;
                  });
                } catch (error) {
                  console.error('Error fetching events by date:', error);
                  result = `❌ Error fetching events by date: ${error instanceof Error ? error.message : 'Unknown error'}`;
                  break;
                }
              } else if (action.args.searchQuery) {
                // Use Zep to search for events
                try {
                  // Use Zep memory service for intelligent event search
                  const searchMemoryResults = await this.zepService.searchMemory(
                    state.userId,
                    `calendar events ${action.args.searchQuery}`,
                    50
                  );

                  // Also search directly in database
                  const { SupabaseService } = await import('../../services/SupabaseService.js');
                  const supabaseService = new SupabaseService();
                  const allEvents = await supabaseService.getEventsForAgent(state.userId);
                  const matchingEvents = allEvents.filter((event: any) => {
                    const searchText = `${event.event_title} ${event.event_description || ''}`.toLowerCase();
                    return searchText.includes(action.args.searchQuery.toLowerCase());
                  });

                  console.log(`🔍 Found ${matchingEvents.length} events matching search query`);
                } catch (error) {
                  console.error('Error searching for events to delete:', error);
                  result = `❌ Error searching for events: ${error instanceof Error ? error.message : 'Unknown error'}`;
                  break;
                }
              }

              // Delete all found events
              for (const event of eventsToDelete) {
                try {
                  // Delete event using SupabaseService
                  const supabaseService = new SupabaseService();
                  const success = await supabaseService.deleteEvent(state.userId, event.id);
                  
                  if (success) {
                    deletedCount++;
                  } else {
                    console.error('Failed to delete event:', event.id);
                  }
                } catch (error) {
                  console.error('Error deleting event:', event.id, error);
                }
              }

              if (deletedCount > 0) {
                result = `Deleted ${deletedCount} event(s) successfully`;
              } else if (eventsToDelete.length === 0) {
                result = `ℹ️ No events found to delete`;
              } else {
                result = `❌ Failed to delete events`;
              }
              break;

            case "list_events":
              try {
                // Get events using SupabaseService
                const supabaseService = new SupabaseService();
                const events = await supabaseService.getEventsForAgent(state.userId);
                
                // Filter by date range if provided
                let filteredEvents = events || [];
                if (action.args.startDate) {
                  const startDate = new Date(action.args.startDate);
                  filteredEvents = filteredEvents.filter((e: any) => new Date(e.event_starts_at) >= startDate);
                }
                if (action.args.endDate) {
                  const endDate = new Date(action.args.endDate);
                  filteredEvents = filteredEvents.filter((e: any) => new Date(e.event_starts_at) <= endDate);
                }
                
                result = `📅 Found ${filteredEvents.length} events`;
                if (filteredEvents.length > 0) {
                  const eventList = filteredEvents.slice(0, 5).map((e: any) => 
                    `• ${e.event_title} (${new Date(e.event_starts_at).toLocaleDateString()})`
                  ).join('\n');
                  result += `:\n${eventList}`;
                  if (filteredEvents.length > 5) result += `\n...and ${filteredEvents.length - 5} more`;
                }
              } catch (error) {
                console.error('Error listing events:', error);
                result = `❌ Error listing events: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
              break;

            case "search_events":
              try {
                // Use Zep memory service for intelligent event search
                const searchMemoryResults = await this.zepService.searchMemory(
                  state.userId,
                  `calendar events ${action.args.query}`,
                  10
                );

                // Also search directly in database
                const { SupabaseService } = await import('../../services/SupabaseService.js');
                const supabaseService = new SupabaseService();
                const allEvents = await supabaseService.getEventsForAgent(state.userId);
                const matchingEvents = allEvents.filter((event: any) => {
                  const searchText = `${event.event_title} ${event.event_description || ''}`.toLowerCase();
                  return searchText.includes(action.args.query.toLowerCase());
                });

                if (matchingEvents.length > 0) {
                  const eventList = matchingEvents.slice(0, 5).map((event: any) => {
                    return `• ${event.event_title} (${new Date(event.event_starts_at).toLocaleDateString()})`;
                  }).join('\n');
                  result = `🔍 Found ${matchingEvents.length} events:\n${eventList}`;
                  if (matchingEvents.length > 5) result += `\n...and ${matchingEvents.length - 5} more`;
                } else {
                  result = `🔍 No events found matching: "${action.args.query}"`;
                }
              } catch (error) {
                console.error('Error searching events:', error);
                result = `❌ Error searching events: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
              break;

            case "create_task":
              // TODO: Implement task creation when task schema is ready
              result = `✅ Task creation planned: "${action.args.title}" (task system not yet implemented)`;
              break;

            // REMOVED find_free_time - tool removed per cleanup

            // REMOVED daily_briefing - using natural agent responses instead

            case "search_memory":
              try {
                const searchResults = await this.zepService.searchMemory(
                  state.userId,
                  action.query,
                  10 // limit to 10 results
                );
                
                if (searchResults.length > 0) {
                  const formattedResults = searchResults
                    .slice(0, 5) // Take top 5 results
                    .map((item, index) => `${index + 1}. ${JSON.stringify(item)}`)
                    .join('\n');
                  
                  result = `🧠 Memory search results for "${action.query}":\n${formattedResults}`;
                } else {
                  result = `🧠 No relevant memories found for "${action.query}". This might be the first time this topic has come up.`;
                }
                
                console.log(`Zep memory search completed for user ${state.userId}: "${action.query}"`);
              } catch (error) {
                console.error('Failed to search Zep memory:', error);
                result = `🧠 Memory search temporarily unavailable. Using conversation context instead.`;
              }
              break;

            default:
              result = `❌ Unknown action: ${action.name}`;
          }
          
          results.push(result);
        } catch (error) {
          console.error('Error executing action:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push(`❌ Failed to execute ${action.name}: ${errorMessage}`);
        }
      }

      return {
        lastResult: results.join('\n'),
        pendingActions: [],
      };
    };

    // Determine if we should continue to tools or finish
    const shouldContinue = (state: ConversationStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        return "tools";
      }
      return "execute";
    };

    const shouldExecute = (state: ConversationStateType) => {
      if (state.pendingActions.length > 0) {
        return "execute_ops";
      }
      return "__end__";
    };

    // Build the graph
    const workflow = new StateGraph(ConversationState)
      .addNode("agent", callModel)
      .addNode("tools", executeTools)
      .addNode("execute_ops", executeActualOperations)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addConditionalEdges("tools", shouldExecute)
      .addEdge("execute_ops", "__end__");

    return workflow.compile();
  }

}