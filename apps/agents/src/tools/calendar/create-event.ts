import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { convertToUTC, formatEventTime } from "../../utils/timezoneUtils.js";

export const createEventTool = tool(
  async ({ title, startTime, endTime, location, description, category }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      throw new Error("User ID is required for creating events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for creating events");
    }

    console.log('🔧 [CREATE-EVENT TOOL] Starting event creation:', { title, startTime, endTime, category, timezone });

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();

    // Convert local times to UTC for storage
    const startTimeUTC = convertToUTC(startTime, timezone);
    const endTimeUTC = convertToUTC(endTime, timezone);

    console.log(`🌍 [CREATE-EVENT TOOL] Converted times - Local: ${startTime} → UTC: ${startTimeUTC}`);

    // Check for conflicts using UTC times
    try {
      const existingEvents = await supabaseService.getEvents(userId);
      const startDateTime = new Date(startTimeUTC);
      const endDateTime = new Date(endTimeUTC);

      const conflictingEvents = existingEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);

        return (
          (startDateTime >= eventStart && startDateTime < eventEnd) ||
          (endDateTime > eventStart && endDateTime <= eventEnd) ||
          (startDateTime <= eventStart && endDateTime >= eventEnd)
        );
      });

      if (conflictingEvents.length > 0) {
        const conflictingEvent = conflictingEvents[0];
        return `⚠️ Time conflict detected! You already have "${conflictingEvent.title}" scheduled at ${formatEventTime(conflictingEvent.start_time, timezone)}. Please choose a different time or let me know if you'd like to reschedule the existing event.`;
      }
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      // Continue with event creation if conflict check fails
    }

    // Create the event with UTC times
    const event = await supabaseService.createEvent(userId, {
      title,
      start_time: startTimeUTC,
      end_time: endTimeUTC,
      location: location || "",
      description: description || "",
      category: category || 'Personal'
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
          startTime: startTimeUTC,  // Store UTC in graph
          endTime: endTimeUTC,      // Store UTC in graph
          location: location || undefined,
          description: description || undefined,
          category: category || 'Personal',
          participants: [],
          topics: [],
          createdAt: new Date().toISOString()
        });

        console.log(`✅ [CREATE-EVENT TOOL] Event added to knowledge graph with category: ${category}`);
      } catch (error) {
        console.error('⚠️ [CREATE-EVENT TOOL] Failed to add event to knowledge graph (non-critical):', error);
      }
    };

    // Fire and forget - don't await this
    addToGraph();

    // Add context about category in response
    const categoryContext = category
      ? ` in category "${category}"`
      : '';

    return `✅ Event created successfully: "${title}" at ${formatEventTime(startTimeUTC, timezone)}${categoryContext}`;
  },
  {
    name: "create_event",
    description: "Create a new calendar event. Assign the event to an appropriate category. If the category doesn't exist, you can create it first using create_category tool.",
    schema: z.object({
      title: z.string().describe("Event title extracted from user input or inferred from context. Make it descriptive and clear."),
      startTime: z.string().describe("Start time in ISO format. Parse relative dates like 'tomorrow', '1pm', 'Friday' into proper timestamps. Use intelligent time defaults: breakfast=morning, lunch=midday, dinner=evening, meetings=business hours"),
      endTime: z.string().describe("End time in ISO format. If not specified, add 1 hour to start time"),
      location: z.string().nullable().describe("Event location. Leave empty if not specified"),
      description: z.string().nullable().describe("Event description. Leave empty if not specified"),
      category: z.string().nullable().describe("Category name for this event (e.g., 'Work', 'School', 'Health & Hygiene', 'Social', 'Fitness'). Use existing categories when possible. Defaults to 'Personal' if not specified."),
    }),
  }
);;;;;;