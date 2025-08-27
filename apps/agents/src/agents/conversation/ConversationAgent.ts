import { StateGraph, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService, supabase } from '../../services/SupabaseService.js';
import { BaseAgent } from '../base/BaseAgent.js';
import { AgentContext, AgentResponse, AgentType } from '../../types/agents.js';
import { CalendarIntelligenceService } from '../../services/CalendarIntelligenceService.js';

// Utility function to create a local time example for the prompt
function createLocalTimeExample(hour: number, minute: number = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  // Return both local time representation and ISO for clarity
  return `${date.toISOString()} (which represents ${hour}:${minute.toString().padStart(2, '0')} local time)`;
}

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
    reducer: (existing, update) => update || existing,
    default: () => [],
  }),
  pendingActions: Annotation<any[]>({
    reducer: (existing, update) => update,
    default: () => [],
  }),
  lastResult: Annotation<string>({
    reducer: (existing, update) => update,
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
      // Pre-load user events for context
      const supabaseService = new SupabaseService();
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
      
      const result = await this.graph.invoke({
        messages: messages,
        userId: context.userId,
        timezone: context.timezone,
        userEvents: userEvents || [],
      });

      // Get the last AI message and any execution results
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      
      let response = lastAiMessage?.content || "I processed your request.";
      
      if (result.lastResult) {
        response += `\n\n${result.lastResult}`;
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
    const createEventTool = tool(
      async ({ title, startTime, endTime, location, description }) => {
        const event = {
          event_title: title,
          event_starts_at: startTime,
          event_ends_at: endTime,
          event_location: location || "",
          event_description: description || "",
        };
        return `Event creation parameters: ${JSON.stringify(event)}`;
      },
      {
        name: "create_event",
        description: "Create a new calendar event. Parse natural language into structured event data. Use smart defaults for missing information. Be intelligent about time defaults based on event type.",
        schema: z.object({
          title: z.string().describe("Event title extracted from user input or inferred from context"),
          startTime: z.string().describe("Start time in ISO format WITHOUT Z suffix (e.g., '2025-08-25T17:00:00.000' for 5pm). CRITICAL: When user says '5pm', create timestamp for 5pm LOCAL TIME, NOT UTC. Example: '5pm tomorrow' = '2025-08-26T17:00:00.000' (no Z). Use intelligent defaults: breakfast=8am, lunch=12pm, dinner=6pm, meetings=business hours"),
          endTime: z.string().describe("End time in ISO format WITHOUT Z suffix. CRITICAL: Must match startTime format (no Z). If not specified, add 1 hour to start time"),
          location: z.string().nullable().describe("Event location. Leave empty if not specified"),
          description: z.string().nullable().describe("Event description. Leave empty if not specified"),
        }),
      }
    );

    const updateEventTool = tool(
      async ({ eventId, title, startTime, endTime, location, description }) => {
        const updates = {
          event_title: title,
          event_starts_at: startTime,
          event_ends_at: endTime,
          event_location: location,
          event_description: description,
        };
        return `Event update parameters: ${JSON.stringify({ eventId, updates })}`;
      },
      {
        name: "update_event",
        description: "Update an existing calendar event. If eventId is not provided, use semantic search to find the event by description.",
        schema: z.object({
          eventId: z.string().nullable().describe("Event ID to update (optional - if not provided, search by description)"),
          searchQuery: z.string().nullable().describe("Search query to find the event if eventId is not provided"),
          title: z.string().nullable().describe("New event title"),
          startTime: z.string().nullable().describe("New start time in ISO format WITHOUT Z suffix. CRITICAL: Use local time format (e.g., '2025-08-25T17:00:00.000' for 5pm local)"),
          endTime: z.string().nullable().describe("New end time in ISO format WITHOUT Z suffix. CRITICAL: Must match startTime format"),
          location: z.string().nullable().describe("New event location"),
          description: z.string().nullable().describe("New event description"),
        }),
      }
    );

    const listEventsTool = tool(
      async ({ startDate, endDate }) => {
        return `List events parameters: ${JSON.stringify({ startDate, endDate })}`;
      },
      {
        name: "list_events",
        description: "List calendar events in a date range",
        schema: z.object({
          startDate: z.string().nullable().describe("Start date in ISO format"),
          endDate: z.string().nullable().describe("End date in ISO format"),
        }),
      }
    );

    const searchEventsTool = tool(
      async ({ query }) => {
        return `Search events parameters: ${JSON.stringify({ query })}`;
      },
      {
        name: "search_events",
        description: "Search calendar events by text query",
        schema: z.object({
          query: z.string().describe("Search query"),
        }),
      }
    );

    const deleteEventTool = tool(
      async ({ eventId, searchQuery }) => {
        return `Delete event parameters: ${JSON.stringify({ eventId, searchQuery })}`;
      },
      {
        name: "delete_event",
        description: "Delete an existing calendar event. If eventId is not provided, use semantic search to find the event by description.",
        schema: z.object({
          eventId: z.string().nullable().describe("Event ID to delete (optional - if not provided, search by description)"),
          searchQuery: z.string().nullable().describe("Search query to find the event if eventId is not provided"),
        }),
      }
    );

    const deleteMultipleEventsTool = tool(
      async ({ date, searchQuery }) => {
        return `Delete multiple events parameters: ${JSON.stringify({ date, searchQuery })}`;
      },
      {
        name: "delete_multiple_events",
        description: "Delete multiple events based on date or search criteria. Use this when user wants to delete 'all events on a day' or multiple events matching criteria.",
        schema: z.object({
          date: z.string().nullable().describe("Date to delete all events from (ISO format)"),
          searchQuery: z.string().nullable().describe("Search query to find multiple events to delete"),
        }),
      }
    );

    const createTaskTool = tool(
      async ({ title, description, dueDate, priority }) => {
        const task = {
          title,
          description,
          due_date: dueDate,
          priority,
        };
        return `Task creation parameters: ${JSON.stringify(task)}`;
      },
      {
        name: "create_task",
        description: "Create a new task",
        schema: z.object({
          title: z.string().describe("Task title"),
          description: z.string().nullable().describe("Task description"),
          dueDate: z.string().nullable().describe("Due date in ISO format"),
          priority: z.enum(["low", "medium", "high"]).nullable().describe("Task priority"),
        }),
      }
    );

    const findFreeTimeTool = tool(
      async ({ duration, date }) => {
        return `Find free time parameters: ${JSON.stringify({ duration, date })}`;
      },
      {
        name: "find_free_time",
        description: "Find available time slots in the calendar",
        schema: z.object({
          duration: z.number().describe("Duration needed in minutes"),
          date: z.string().nullable().describe("Date to search (ISO format). If null, searches from today"),
        }),
      }
    );

    const getDailyBriefingTool = tool(
      async ({ date }) => {
        return `Get daily briefing for: ${date || 'today'}`;
      },
      {
        name: "daily_briefing",
        description: "Get a summary of the day's events and insights",
        schema: z.object({
          date: z.string().nullable().describe("Date for briefing (ISO format). If null, uses today"),
        }),
      }
    );

    const tools = [createEventTool, updateEventTool, deleteEventTool, deleteMultipleEventsTool, listEventsTool, searchEventsTool, createTaskTool, findFreeTimeTool, getDailyBriefingTool];
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
            recentEvents = eventsData; // Get all events for better context
            console.log(`Found ${recentEvents.length} events for user context`);
          } else {
            console.log('No events found for user context');
          }
        } catch (error) {
          console.error('Error loading recent events for context:', error);
        }
      }
      
      // Get recent chat messages for conversation context
      const recentMessages = state.messages.slice(-5); // Last 5 messages
      const conversationContext = recentMessages.length > 0 
        ? `\n\nRECENT CONVERSATION:\n${recentMessages.map(msg => {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return `${msg._getType()}: ${content.substring(0, 100)}`;
          }).join('\n')}`
        : '';
      
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
      
      
      const systemMessage = new SystemMessage(`You are an intelligent personal calendar assistant. You help users manage their time effectively.

CRITICAL: Your user's complete calendar (ALL EVENTS):${eventContext}

CURRENT TIME CONTEXT:
- Right now: ${now.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
- Today's date: ${formatDateForComparison(now)}
- Tomorrow's date: ${formatDateForComparison(tomorrow)} (${tomorrow.toLocaleDateString('en-US', { weekday: 'long' })})
- Day after tomorrow: ${formatDateForComparison(dayAfterTomorrow)} (${dayAfterTomorrow.toLocaleDateString('en-US', { weekday: 'long' })})

YOUR CAPABILITIES:
1. Answer calendar questions using the events listed above
2. Create new events with natural language understanding
3. Update and delete events
4. Find scheduling conflicts
5. Suggest optimal meeting times
6. Provide daily briefings and summaries

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
- Parse natural language dates/times intelligently
- "2pm tomorrow" = tomorrow at 14:00 LOCAL TIME
- "lunch next Tuesday" = next Tuesday at 12:00 LOCAL TIME  
- "5pm" means 5pm in user's timezone, NOT 5pm UTC
- Use 1 hour duration if not specified
- Check for conflicts and warn the user
- Confirm what you scheduled

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
1. Create, update, delete, and search calendar events
2. Detect and warn about scheduling conflicts
3. Find free time slots in the calendar
4. Generate daily briefings and weekly summaries
5. Smart scheduling with preferences
6. Parse natural language into structured actions
7. ALWAYS use the most appropriate tool based on user intent

INTELLIGENCE FEATURES:
- When user asks "When am I free?" or "Find time for X" → use find_free_time
- When user asks "What's my day like?" or "Give me a summary" → use daily_briefing
- When creating events, ALWAYS check for conflicts and warn the user
- Suggest alternative times when conflicts are detected`);

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
              try {
                // Check for conflicts first
                const intelligenceService = new CalendarIntelligenceService(state.userId);
                const conflictCheck = await intelligenceService.checkConflicts(
                  new Date(action.args.startTime),
                  new Date(action.args.endTime)
                );
                
                if (conflictCheck.hasConflict) {
                  const conflictingEvent = conflictCheck.conflictingEvents[0];
                  result = `⚠️ Time conflict detected with "${conflictingEvent.title}". ${conflictCheck.suggestion || 'Please choose a different time.'}`;
                  break;
                }
                
                // Create event using SupabaseService to write to public.events table
                const supabaseService = new SupabaseService();
                const createdEvent = await supabaseService.createEvent(state.userId, {
                  event_title: action.args.title,
                  event_starts_at: action.args.startTime,
                  event_ends_at: action.args.endTime,
                  event_location: action.args.location || null,
                  event_description: action.args.description || null,
                });
                
                if (!createdEvent) {
                  result = `❌ Failed to create event: Unknown error`;
                } else {
                  // Category name can be inferred from event title or type
                  const categoryName = 'Event';
                  result = `✅ Created event: "${action.args.title}" (${categoryName})`;
                }
              } catch (error) {
                console.error('Error creating event:', error);
                result = `❌ Error creating event: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
              break;

            case "update_event":
              let eventId = action.args.eventId;
              
              // If no eventId provided, search for the event semantically
              if (!eventId && action.args.searchQuery) {
                try {
                  const { EmbeddingService } = await import('../../services/EmbeddingService.js');
                  const embeddingService = new EmbeddingService();
                  const searchResults = await embeddingService.searchSimilarEvents(
                    state.userId,
                    action.args.searchQuery,
                    1
                  );
                  
                  if (searchResults.length > 0) {
                    eventId = searchResults[0].metadata.id;
                    result = `🔍 Found event: "${searchResults[0].metadata.event_title}" - updating...`;
                  } else {
                    // Semantic search returned empty, try fallback
                    throw new Error('No results from semantic search, trying fallback');
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
                    result = `✅ Updated event successfully (${updatedFields})`;
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
              
              // If no eventId provided, search for the event semantically
              if (!deleteEventId && action.args.searchQuery) {
                try {
                  // First try semantic search
                  const { EmbeddingService } = await import('../../services/EmbeddingService.js');
                  const embeddingService = new EmbeddingService();
                  const searchResults = await embeddingService.searchSimilarEvents(
                    state.userId,
                    action.args.searchQuery,
                    1
                  );
                  
                  if (searchResults.length > 0) {
                    deleteEventId = searchResults[0].metadata.id;
                    result = `🔍 Found event: "${searchResults[0].metadata.event_title}" - deleting...`;
                  } else {
                    // Semantic search returned empty, try fallback
                    throw new Error('No results from semantic search, trying fallback');
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
                    result = `✅ Deleted event successfully`;
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
                // Use semantic search to find events
                try {
                  // Searching events by query
                  
                  const { EmbeddingService } = await import('../../services/EmbeddingService.js');
                  const embeddingService = new EmbeddingService();
                  const searchResults = await embeddingService.searchSimilarEvents(
                    state.userId,
                    action.args.searchQuery,
                    10
                  );
                  
                  // Found events by search
                  // Search results retrieved
                  
                  eventsToDelete = searchResults.map(doc => ({
                    id: doc.metadata.id,
                    event_title: doc.metadata.event_title,
                    event_starts_at: doc.metadata.event_starts_at,
                    event_ends_at: doc.metadata.event_ends_at
                  }));
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
                result = `✅ Deleted ${deletedCount} event(s) successfully`;
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
                const { EmbeddingService } = await import('../../services/EmbeddingService.js');
                const embeddingService = new EmbeddingService();
                const searchResults = await embeddingService.searchSimilarEvents(
                  state.userId, 
                  action.args.query, 
                  5
                );
                
                if (searchResults.length > 0) {
                  const eventList = searchResults.map(doc => {
                    const metadata = doc.metadata;
                    return `• ${metadata.event_title} (${new Date(metadata.event_starts_at).toLocaleDateString()})`;
                  }).join('\n');
                  result = `🔍 Found ${searchResults.length} similar events:\n${eventList}`;
                } else {
                  result = `🔍 No similar events found for: "${action.args.query}"`;
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

            case "find_free_time":
              try {
                const intelligenceService = new CalendarIntelligenceService(state.userId);
                const startDate = action.args.date ? new Date(action.args.date) : new Date();
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 7); // Search 1 week ahead
                
                const freeSlots = await intelligenceService.findFreeTimeSlots(
                  startDate,
                  endDate,
                  action.args.duration || 60
                );
                
                if (freeSlots.length > 0) {
                  const topSlots = freeSlots.slice(0, 3);
                  result = `📅 Found ${freeSlots.length} free time slots:\n`;
                  topSlots.forEach(slot => {
                    const start = new Date(slot.start);
                    result += `• ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${slot.duration} minutes, ${slot.quality} time)\n`;
                  });
                } else {
                  result = `❌ No free time slots found for ${action.args.duration} minutes in the next week`;
                }
              } catch (error) {
                console.error('Error finding free time:', error);
                result = `❌ Error finding free time: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
              break;

            case "daily_briefing":
              try {
                const intelligenceService = new CalendarIntelligenceService(state.userId);
                const briefingDate = action.args.date ? new Date(action.args.date) : new Date();
                const briefing = await intelligenceService.getDailyBriefing(briefingDate);
                result = briefing;
              } catch (error) {
                console.error('Error generating briefing:', error);
                result = `❌ Error generating briefing: ${error instanceof Error ? error.message : 'Unknown error'}`;
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