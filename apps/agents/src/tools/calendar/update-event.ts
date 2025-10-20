import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const updateEventTool = tool(
  async ({ eventId, searchQuery, title, startTime, endTime, location, description, category }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      throw new Error("User ID is required for updating events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for updating events");
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

        // Also search directly in database (use getEvents instead of deprecated getEventsForAgent)
        const events = await supabaseService.getEvents(userId);
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

    // Convert local times to UTC for storage (same as create-event)
    const startTimeUTC = startTime ? convertToUTC(startTime, timezone) : undefined;
    const endTimeUTC = endTime ? convertToUTC(endTime, timezone) : undefined;

    if (startTimeUTC || endTimeUTC) {
      console.log(`🌍 [UPDATE-EVENT TOOL] Timezone conversion - ${startTime} → ${startTimeUTC}`);
    }

    const updatedEvent = await supabaseService.updateEvent(
      userId,
      targetEventId,
      {
        title: title || undefined,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        location: location || undefined,
        description: description || undefined,
        category: category || undefined,
      }
    );

    if (!updatedEvent) {
      throw new Error("Failed to update event");
    }

    // Update knowledge graph asynchronously (fire-and-forget for speed)
    const updateGraph = async () => {
      try {
        console.log('🧠 [UPDATE-EVENT TOOL] Updating knowledge graph (async)...');

        const startDate = new Date(updatedEvent.start_time);
        const endDate = new Date(updatedEvent.end_time);
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

        await zepGraphService.updateCalendarEvent(userId, targetEventId, {
          eventId: updatedEvent.id,
          title: updatedEvent.title,
          category: category || 'Personal',
          duration_minutes: durationMinutes,
          energy_level: 'medium',
          location: updatedEvent.location || undefined,
          attendee_count: 0
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