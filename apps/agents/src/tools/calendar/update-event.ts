import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const updateEventTool = tool(
  async ({ eventId, searchQuery, title, startTime, endTime, location, description, archetype, archetype_data }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for updating events");
    }

    let targetEventId = eventId;

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();

    // If no eventId provided, search for the event using Zep and direct search
    if (!targetEventId && searchQuery) {
      console.log('🔍 [UPDATE-EVENT TOOL] Searching for event to update:', searchQuery);

      try {
        // Search knowledge graph for relevant events
        const graphResults = await zepGraphService.searchEntities(userId,
          `calendar event ${searchQuery}`,
          undefined, // entityType
          5 // limit
        );

        // Also search directly in database
        const events = await supabaseService.getEventsForAgent(userId);
        const matchingEvents = events.filter((event: any) => {
          const searchText = `${event.event_title} ${event.event_description || ''}`.toLowerCase();
          return searchText.includes(searchQuery.toLowerCase());
        });

        if (matchingEvents.length > 0) {
          targetEventId = matchingEvents[0].id;
          console.log('✅ [UPDATE-EVENT TOOL] Found event to update:', matchingEvents[0].event_title);
        } else {
          throw new Error(`No event found matching: "${searchQuery}"`);
        }
      } catch (error) {
        console.error('❌ [UPDATE-EVENT TOOL] Search error:', error);
        throw new Error(`Failed to find event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!targetEventId) {
      throw new Error("No event ID provided and no search query given");
    }

    const updatedEvent = await supabaseService.updateEvent(
      userId,
      targetEventId,
      {
        event_title: title || undefined,
        event_starts_at: startTime || undefined,
        event_ends_at: endTime || undefined,
        event_location: location || undefined,
        event_description: description || undefined,
        archetype: archetype || undefined,
        archetype_data: archetype_data || undefined,
      }
    );

    if (!updatedEvent) {
      throw new Error("Failed to update event");
    }

    // Update knowledge graph asynchronously (fire-and-forget for speed)
    const updateGraph = async () => {
      try {
        console.log('🧠 [UPDATE-EVENT TOOL] Updating knowledge graph (async)...');

        await zepGraphService.updateCalendarEvent(userId, targetEventId, {
          type: 'CalendarEvent',
          eventId: updatedEvent.id,
          title: updatedEvent.event_title,
          startTime: updatedEvent.event_starts_at,
          endTime: updatedEvent.event_ends_at,
          location: updatedEvent.event_location || undefined,
          description: updatedEvent.event_description || undefined,
          archetype: updatedEvent.archetype || 'generic',
          archetypeData: updatedEvent.archetype_data || {},
          participants: [],
          topics: [],
          createdAt: new Date().toISOString()
        });

        console.log(`✅ [UPDATE-EVENT TOOL] Event updated in knowledge graph`);
      } catch (error) {
        console.error('⚠️ [UPDATE-EVENT TOOL] Failed to update event in knowledge graph (non-critical):', error);
      }
    };

    // Fire and forget - don't await this
    updateGraph();

    // Add context about archetype updates in response
    const archetypeContext = archetype && archetype !== 'generic'
      ? ` (updated to ${archetype} type)`
      : archetype_data
        ? ` (with updated smart details)`
        : '';

    return `✅ Event updated: "${title || updatedEvent.event_title}"${archetypeContext}`;
  },
  {
    name: "update_event",
    description: "Update an existing calendar event with intelligent archetype detection and structured data updates. If eventId is not provided, use semantic search to find the event by description. Can update event type and extract new structured data from user prompts.",
    schema: z.object({
      eventId: z.string().nullable().describe("Event ID to update (optional - if not provided, search by description)"),
      searchQuery: z.string().nullable().describe("Search query to find the event if eventId is not provided (e.g., 'grocery trip', 'meeting with John', 'workout yesterday')"),
      title: z.string().nullable().describe("New event title - leave empty to keep existing"),
      startTime: z.string().nullable().describe("New start time in ISO format - leave empty to keep existing"),
      endTime: z.string().nullable().describe("New end time in ISO format - leave empty to keep existing"),
      location: z.string().nullable().describe("New event location - leave empty to keep existing"),
      description: z.string().nullable().describe("New event description - leave empty to keep existing"),
      archetype: z.enum(['grocery', 'meeting', 'workout', 'appointment', 'travel', 'work_focus', 'personal', 'generic']).nullable()
        .describe("Update event type based on changes. Intelligently detect from user input like 'change to meeting', 'make it a workout', etc. Leave empty to keep existing archetype."),
      archetype_data: z.record(z.any()).nullable()
        .describe(`Update structured data for the event. Extract relevant data based on archetype and user input. Examples:

GROCERY: {items: [{item: "milk", quantity: "2 gallons", completed: false}, {item: "bread", quantity: "1 loaf", completed: true}]}

MEETING: {attendees: ["John", "Sarah", "Mike"], agenda: "Updated Q4 planning discussion", meeting_link: "https://zoom.us/..."}

WORKOUT: {exercises: [{name: "squats", sets: 4, reps: 12}, {name: "deadlifts", sets: 3, reps: 8}]}

APPOINTMENT: {provider: "Dr. Johnson", type: "follow-up", location: "Medical Center Downtown"}

TRAVEL: {destination: "San Francisco", departure_time: "3:00 PM", transport: "flight AA123"}

WORK_FOCUS: {tasks: [{task: "complete code review", completed: true}, {task: "write documentation", completed: false}]}

PERSONAL: {notes: "Family dinner celebration, bring dessert"}

Extract updates from user input like "add milk to the list", "mark bread as completed", "add Sarah to attendees", "change location to downtown office", etc. Merge with existing data when possible.`)
    }),
  }
);