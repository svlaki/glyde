import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const deleteEventTool = tool(
  async ({ eventId, searchQuery }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for deleting events");
    }

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();

    let targetEventId = eventId;

    // If no eventId provided, search for the event using Zep and direct search
    if (!targetEventId && searchQuery) {
      console.log('🔍 [DELETE-EVENT TOOL] Searching for event to delete:', searchQuery);

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
          console.log('✅ [DELETE-EVENT TOOL] Found event to delete:', matchingEvents[0].title);
        } else {
          throw new Error(`No event found matching: "${searchQuery}"`);
        }
      } catch (error) {
        console.error('❌ [DELETE-EVENT TOOL] Search error:', error);
        throw new Error(`Failed to find event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!targetEventId) {
      throw new Error("No event ID provided and no search query given");
    }

    const deleteResult = await supabaseService.deleteEvent(userId, targetEventId);

    if (!deleteResult.success) {
      throw new Error(`Failed to delete event: ${deleteResult.error}`);
    }

    // Remove from knowledge graph asynchronously (fire-and-forget for speed)
    const removeFromGraph = async () => {
      try {
        console.log('🧠 [DELETE-EVENT TOOL] Removing from knowledge graph (async)...');

        await zepGraphService.deleteCalendarEvent(targetEventId);

        console.log(`✅ [DELETE-EVENT TOOL] Event removed from knowledge graph`);
      } catch (error) {
        console.error('⚠️ [DELETE-EVENT TOOL] Failed to remove event from knowledge graph (non-critical):', error);
      }
    };

    // Fire and forget - don't await this
    removeFromGraph();

    return `Event deleted successfully`;
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