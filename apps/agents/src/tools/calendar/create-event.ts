import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const createEventTool = tool(
  async ({ title, startTime, endTime, location, description, archetype, archetype_data }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for creating events");
    }

    console.log('🔧 [CREATE-EVENT TOOL] Starting event creation:', { title, startTime, endTime, archetype });

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();

    // Check for conflicts BEFORE creating the event using simple overlap detection
    try {
      const existingEvents = await supabaseService.getEventsForAgent(userId);
      const startDateTime = new Date(startTime);
      const endDateTime = new Date(endTime);

      const conflictingEvents = existingEvents.filter(event => {
        const eventStart = new Date(event.event_starts_at);
        const eventEnd = new Date(event.event_ends_at);

        return (
          (startDateTime >= eventStart && startDateTime < eventEnd) ||
          (endDateTime > eventStart && endDateTime <= eventEnd) ||
          (startDateTime <= eventStart && endDateTime >= eventEnd)
        );
      });

      if (conflictingEvents.length > 0) {
        const conflictingEvent = conflictingEvents[0];
        const conflictStartTime = new Date(conflictingEvent.event_starts_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        const conflictEndTime = new Date(conflictingEvent.event_ends_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        return `⚠️ Time conflict detected! You already have "${conflictingEvent.event_title}" scheduled from ${conflictStartTime} to ${conflictEndTime}. Please choose a different time or let me know if you'd like to reschedule the existing event.`;
      }
    } catch (error) {
      console.error('🚨 [CREATE-EVENT TOOL] Error checking for conflicts:', error);
      // Continue with event creation if conflict check fails
    }

    // Create the event with archetype data if detected
    console.log('🔄 [CREATE-EVENT TOOL] Calling supabaseService.createEvent...');
    const event = await supabaseService.createEvent(userId, {
      event_title: title,
      event_starts_at: startTime,
      event_ends_at: endTime,
      event_location: location || "",
      event_description: description || "",
      archetype: archetype || 'generic',
      archetype_data: archetype_data || {}
    });

    console.log('📋 [CREATE-EVENT TOOL] SupabaseService returned:', event ? 'SUCCESS' : 'NULL');
    
    if (!event) {
      console.error('❌ [CREATE-EVENT TOOL] Event creation failed - supabaseService.createEvent returned null');
      throw new Error("Failed to create event - database operation returned null. Check server logs for details.");
    }

    console.log('✅ [CREATE-EVENT TOOL] Event created successfully:', event.id);

    // Add to knowledge graph asynchronously (fire-and-forget for speed)
    const addToGraph = async () => {
      try {
        console.log('🧠 [CREATE-EVENT TOOL] Adding to knowledge graph (async)...');

        await zepGraphService.addCalendarEvent(userId, {
          type: 'CalendarEvent',
          eventId: event.id,
          title,
          startTime,
          endTime,
          location: location || undefined,
          description: description || undefined,
          archetype: archetype || 'generic',
          archetypeData: archetype_data || {},
          participants: [],
          topics: [],
          createdAt: new Date().toISOString()
        });

        console.log(`✅ [CREATE-EVENT TOOL] Event added to knowledge graph with archetype: ${archetype}`);
      } catch (error) {
        console.error('⚠️ [CREATE-EVENT TOOL] Failed to add event to knowledge graph (non-critical):', error);
      }
    };

    // Fire and forget - don't await this
    addToGraph();

    // Add context about detected archetype in response
    const archetypeContext = archetype && archetype !== 'generic' 
      ? ` with smart ${archetype} details` 
      : '';

    return `✅ Event created successfully: "${title}" at ${new Date(startTime).toLocaleString()}${archetypeContext}`;
  },
  {
    name: "create_event",
    description: "Create a new calendar event with intelligent archetype detection. Parse natural language into structured event data and detect event types automatically. Extract relevant structured data based on context.",
    schema: z.object({
      title: z.string().describe("Event title extracted from user input or inferred from context. Make it descriptive and clear."),
      startTime: z.string().describe("Start time in ISO format. Parse relative dates like 'tomorrow', '1pm', 'Friday' into proper timestamps. Use intelligent time defaults: breakfast=morning, lunch=midday, dinner=evening, meetings=business hours"),
      endTime: z.string().describe("End time in ISO format. If not specified, add 1 hour to start time"),
      location: z.string().nullable().describe("Event location. Leave empty if not specified"),
      description: z.string().nullable().describe("Event description. Leave empty if not specified"),
      archetype: z.enum(['grocery', 'meeting', 'workout', 'appointment', 'travel', 'work_focus', 'personal', 'generic']).nullable()
        .describe("Intelligently detect the event type based on context clues. Examples: 'get milk' → grocery, 'meet with John' → meeting, 'gym time' → workout, 'doctor appointment' → appointment, 'flight to NYC' → travel, 'focus time for coding' → work_focus, 'family dinner' → personal. Use 'generic' if no specific type matches."),
      archetype_data: z.record(z.any()).nullable()
        .describe(`Extract structured data based on archetype. Examples:

GROCERY: {items: [{item: "milk", quantity: "1 gallon", completed: false}, {item: "bread", quantity: "1 loaf", completed: false}]}

MEETING: {attendees: ["John", "Sarah"], agenda: "Q4 planning discussion", meeting_link: null}

WORKOUT: {exercises: [{name: "squats", sets: 3, reps: 10}, {name: "deadlifts", sets: 3, reps: 8}]}

APPOINTMENT: {provider: "Dr. Smith", type: "checkup", location: "Medical Center"}

TRAVEL: {destination: "New York", departure_time: "2:00 PM", transport: "flight"}

WORK_FOCUS: {tasks: [{task: "code review", completed: false}, {task: "write documentation", completed: false}]}

PERSONAL: {notes: "Quality time with family, practice mindfulness"}

GENERIC: {} (empty object)

Extract as much relevant data as possible from the user's input. Use the exact field names shown above.`)
    }),
  }
);;;;;;