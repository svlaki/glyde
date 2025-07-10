import { StateGraph, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from '../../services/SupabaseService.js';

// Utility function to create a local time example for the prompt
function createLocalTimeExample(hour: number, minute: number = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

// Define the state structure for our conversation agent
const ConversationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),
  userId: Annotation<string>(),
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

export class ConversationAgent {
  private graph: any;
  private supabaseService: SupabaseService;
  private model: ChatOpenAI;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.1,
    });

    this.graph = this.createGraph();
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
          startTime: z.string().describe("Start time in ISO format. Parse relative dates like 'tomorrow', '1pm', 'Friday' into proper timestamps. Use intelligent time defaults: breakfast=morning, lunch=midday, dinner=evening, meetings=business hours"),
          endTime: z.string().describe("End time in ISO format. If not specified, add 1 hour to start time"),
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
          startTime: z.string().nullable().describe("New start time in ISO format"),
          endTime: z.string().nullable().describe("New end time in ISO format"),
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

    const tools = [createEventTool, updateEventTool, deleteEventTool, deleteMultipleEventsTool, listEventsTool, searchEventsTool, createTaskTool];
    const toolNode = new ToolNode(tools);

    // Bind tools to the model
    const modelWithTools = this.model.bindTools(tools);

    // Define the workflow nodes
    const callModel = async (state: ConversationStateType) => {
      // Load recent events for context
      const recentEvents = await this.supabaseService.getEvents(state.userId);
      // Debug: Show recent events for context
      if (recentEvents.length > 0) {
        console.log(`Found ${recentEvents.length} events for user context`);
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
        ? `\n\nCURRENT EVENTS:\n${recentEvents.slice(0, 10).map((e, index) => 
            `${index + 1}. ${e.event_title} (${new Date(e.event_starts_at).toLocaleDateString()})`
          ).join('\n')}`
        : '\n\nCURRENT EVENTS: No events found';

      const systemMessage = new SystemMessage(`You are a helpful personal assistant that helps users manage their calendar and tasks through natural language commands.${eventContext}${conversationContext}

Current date and time: ${new Date().toISOString()}
Current LOCAL date: ${new Date().toLocaleDateString()}
Current LOCAL time: ${new Date().toLocaleTimeString()}
Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

CRITICAL: You are running on a server, but the user is in timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
When generating ISO timestamps, you MUST account for the user's timezone offset.

IMPORTANT: When users say "tomorrow" they mean the next LOCAL day, not the next UTC day.
Today (LOCAL): ${new Date().toLocaleDateString()}
Tomorrow (LOCAL): ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}

IMPORTANT INSTRUCTIONS:
1. Always be proactive and helpful - don't ask for clarification unless absolutely necessary
2. Parse natural language dates and times intelligently
3. Use smart defaults for missing information
4. Only ask for clarification if the request is truly ambiguous

Date/Time Parsing Rules - FOLLOW THESE EXACTLY:
- "tomorrow" = THE NEXT LOCAL DAY (${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}) at the specified time or 9am if no time given
- "today" = THE CURRENT LOCAL DAY (${new Date().toLocaleDateString()}) at the specified time
- "1pm to 2pm" = 1:00 PM to 2:00 PM on the specified day (use LOCAL timezone)
- "at 2pm" = 2:00 PM for 1 hour (default duration) in LOCAL timezone
- "next week" = Monday of next week at 9am LOCAL time
- "Friday" = next Friday at 9am LOCAL time (or this Friday if it hasn't passed)
- If no end time: add 1 hour to start time
- If no date: assume today unless time has passed, then tomorrow
- Parse "1pm" as 13:00 LOCAL TIME, "2pm" as 14:00 LOCAL TIME, etc.
- ALWAYS convert to ISO format but respect the user's local timezone
- CRITICAL: Generate timestamps that represent the LOCAL time, not UTC time
- Example: If user wants "lunch at 12pm" and they're in America/Chicago, generate a timestamp that shows 12pm in Chicago, not 12pm UTC
- CORRECT example for 12pm local: ${createLocalTimeExample(12)}
- CORRECT example for 7pm local: ${createLocalTimeExample(19)}

Smart Defaults - USE THESE WITHOUT ASKING:
- Title: Extract from context (e.g., "meeting", "lunch", "doctor appointment") or use "Event"
- Location: Leave empty string unless specified
- Description: Leave empty string unless specified
- Duration: 1 hour if not specified

SMART TIME DEFAULTS when no time is specified:
Use your best judgment for reasonable times based on the event type:
- breakfast → morning time
- lunch → midday time  
- dinner → evening time
- meeting → business hours
- appointment → business hours
- call → afternoon
- workout → morning or evening
- generic events → business hours

Examples of CORRECT parsing - be intelligent about times:
- "Schedule a meeting tomorrow 1pm to 2pm" → specific time given, use it
- "Set up lunch at 12pm" → specific time given, use it
- "Doctor appointment Friday 3pm" → specific time given, use it
- "Book dinner tomorrow" → no time given, pick reasonable dinner time (evening)
- "Lunch tomorrow" → no time given, pick reasonable lunch time (midday)
- "Breakfast meeting" → no time given, pick reasonable breakfast time (morning)
- "Call John Friday" → no time given, pick reasonable call time (afternoon)
- "Workout tomorrow" → no time given, pick reasonable workout time (morning/evening)

CRITICAL - Tool Selection Rules:
- "Delete all events tomorrow/today/Friday" → use delete_multiple_events with date
- "Delete any events tomorrow" → use delete_multiple_events with date  
- "Delete events on [date]" → use delete_multiple_events with date
- "Delete every event in my calendar" → use delete_multiple_events with searchQuery "*" (matches all)
- "Delete all my events" → use delete_multiple_events with searchQuery "*" (matches all)
- "Clear my calendar" → use delete_multiple_events with searchQuery "*" (matches all)
- "Delete everything" → use delete_multiple_events with searchQuery "*" (matches all)

IMPORTANT: When using delete_multiple_events with searchQuery "*", this will delete ALL events in the user's calendar. Only use this for explicit "delete everything" or "clear calendar" requests.

- "Delete my dinner party" → use delete_event with searchQuery
- "Delete the meeting about X" → use delete_event with searchQuery
- "Delete that event" → use delete_event with eventId of most recently mentioned/created event
- "Delete it" → use delete_event with eventId of most recently mentioned/created event
- "Delete all of those" → use delete_multiple_events with searchQuery based on what was just shown/discussed
- "Can I delete all of those" → use delete_multiple_events with searchQuery based on what was just shown/discussed
- "Update my lunch meeting" → use update_event with searchQuery
- "Update that event" → use update_event with eventId of most recently mentioned/created event
- "Search for events about X" → use search_events
- "What events do I have Friday" → use list_events with date range
- "What does my workout schedule look like" → use search_events with "workout gym exercise fitness" query

CONTEXTUAL REFERENCES:
When user says "that event", "it", "the event", etc., refer to:
1. The most recently created event in this conversation
2. The most recently mentioned event by name
3. If unclear, ask for clarification instead of guessing

IMPORTANT: NEVER use partial UUIDs or truncated IDs. Only use full event IDs when provided explicitly.
For contextual references, use semantic search or date-based search instead of guessing IDs.

Your capabilities:
1. Create, update, delete, and search calendar events
2. Create, update, delete, and search tasks
3. Parse natural language into structured actions
4. ALWAYS use the most appropriate tool based on user intent`);

      const messages = [systemMessage, ...state.messages];
      
      const response = await modelWithTools.invoke(messages);
      
      return {
        messages: [response],
      };
    };

    const executeTools = async (state: ConversationStateType) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage._getType() === "ai" && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        const toolResults = await toolNode.invoke(state);
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
              
              const event = await this.supabaseService.createEvent(state.userId, {
                event_title: action.args.title,
                event_starts_at: action.args.startTime,
                event_ends_at: action.args.endTime,
                event_location: action.args.location,
                event_description: action.args.description,
              });
              result = `✅ Created event: "${action.args.title}"`;
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
                    result = `❌ No event found matching: "${action.args.searchQuery}"`;
                    break;
                  }
                } catch (error) {
                  console.error('Error searching for event to update:', error);
                  result = `❌ Error searching for event: ${error instanceof Error ? error.message : 'Unknown error'}`;
                  break;
                }
              }
              
              if (eventId) {
                const updatedEvent = await this.supabaseService.updateEvent(
                  state.userId,
                  eventId,
                  {
                    event_title: action.args.title,
                    event_starts_at: action.args.startTime,
                    event_ends_at: action.args.endTime,
                    event_location: action.args.location,
                    event_description: action.args.description,
                  }
                );
                result = `✅ Updated event: "${action.args.title || 'Event'}"`;
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
                  // Searching for event to delete
                  const { EmbeddingService } = await import('../../services/EmbeddingService.js');
                  const embeddingService = new EmbeddingService();
                  const searchResults = await embeddingService.searchSimilarEvents(
                    state.userId,
                    action.args.searchQuery,
                    1
                  );
                  
                  // Found search results for deletion
                  
                  if (searchResults.length > 0) {
                    deleteEventId = searchResults[0].metadata.id;
                    result = `🔍 Found event: "${searchResults[0].metadata.event_title}" - deleting...`;
                    // Found event to delete
                  } else {
                    result = `❌ No event found matching: "${action.args.searchQuery}"`;
                    // No events found for search query
                    break;
                  }
                } catch (error) {
                  console.error('Error searching for event to delete:', error);
                  result = `❌ Error searching for event: ${error instanceof Error ? error.message : 'Unknown error'}`;
                  break;
                }
              }
              
              if (deleteEventId) {
                // Attempting to delete single event
                const deleteResult = await this.supabaseService.deleteEvent(
                  state.userId,
                  deleteEventId
                );
                // Single delete completed
                if (deleteResult.success) {
                  result = `✅ Deleted event successfully`;
                } else {
                  result = `❌ Failed to delete event: ${deleteResult.error}`;
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
                // Get all events on the specified date
                const startDate = new Date(action.args.date);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 1);
                
                // Searching events by date
                
                eventsToDelete = await this.supabaseService.getEvents(
                  state.userId,
                  startDate.toISOString(),
                  endDate.toISOString()
                );
                
                // Found events by date
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
                  // Attempting to delete event
                  const deleteResult = await this.supabaseService.deleteEvent(
                    state.userId,
                    event.id
                  );
                  // Delete operation completed
                  if (deleteResult.success) {
                    deletedCount++;
                    // Successfully deleted event
                  } else {
                    // Delete failed
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
              const events = await this.supabaseService.getEvents(
                state.userId,
                action.args.startDate,
                action.args.endDate
              );
              result = `📅 Found ${events.length} events`;
              if (events.length > 0) {
                const eventList = events.slice(0, 5).map(e => 
                  `• ${e.event_title} (${new Date(e.event_starts_at).toLocaleDateString()})`
                ).join('\n');
                result += `:\n${eventList}`;
                if (events.length > 5) result += `\n...and ${events.length - 5} more`;
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

  async processMessage(userId: string, message: string): Promise<string> {
    try {
      const result = await this.graph.invoke({
        messages: [new HumanMessage(message)],
        userId,
      });

      // Get the last AI message and any execution results
      const aiMessages = result.messages.filter((m: any) => m._getType() === "ai");
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      
      let response = lastAiMessage?.content || "I processed your request.";
      
      if (result.lastResult) {
        response += `\n\n${result.lastResult}`;
      }

      return response;
    } catch (error) {
      console.error('Error processing message with LangGraph:', error);
      return "Sorry, I encountered an error processing your request. Please try again.";
    }
  }
}