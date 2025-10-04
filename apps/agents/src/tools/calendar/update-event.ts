import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const updateEventTool = tool(
  async ({ eventId, searchQuery, title, startTime, endTime, location, description, category }, config) => {
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
          const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
          return searchText.includes(searchQuery.toLowerCase());
        });

        if (matchingEvents.length > 0) {
          targetEventId = matchingEvents[0].id;
          console.log('✅ [UPDATE-EVENT TOOL] Found event to update:', matchingEvents[0].title);
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
        title: title || undefined,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        location: location || undefined,
        description: description || undefined,
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
          title: updatedEvent.title,
          startTime: updatedEvent.start_time,
          endTime: updatedEvent.end_time,
          location: updatedEvent.location || undefined,
          description: updatedEvent.description || undefined,
          category: category || 'Personal',
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

    // Add context about category updates in response
    const categoryContext = category
      ? ` (category: ${category})`
      : '';

    return `✅ Event updated: "${title || updatedEvent.title}"${categoryContext}`;
  },
  {
    name: "update_event",
    description: "Update an existing calendar event. If eventId is not provided, use semantic search to find the event by description. Can update event category and details.",
    schema: z.object({
      eventId: z.string().nullable().describe("Event ID to update (optional - if not provided, search by description)"),
      searchQuery: z.string().nullable().describe("Search query to find the event if eventId is not provided (e.g., 'grocery trip', 'meeting with John', 'workout yesterday')"),
      title: z.string().nullable().describe("New event title - leave empty to keep existing"),
      startTime: z.string().nullable().describe("New start time in ISO format - leave empty to keep existing"),
      endTime: z.string().nullable().describe("New end time in ISO format - leave empty to keep existing"),
      location: z.string().nullable().describe("New event location - leave empty to keep existing"),
      description: z.string().nullable().describe("New event description - leave empty to keep existing"),
      category: z.string().nullable().describe("Update event category (e.g., 'Work', 'School', 'Health & Hygiene', 'Social', 'Personal'). Leave empty to keep existing category."),
    }),
  }
);