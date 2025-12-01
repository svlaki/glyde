import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const deleteMultipleEventsTool = tool(
  async ({ date, searchQuery }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for deleting events");
    }

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();

    let eventsToDelete: any[] = [];

    console.log('🗑️ [DELETE-MULTIPLE-EVENTS TOOL] Processing bulk deletion:', { date, searchQuery });

    if (date) {
      // Delete events on a specific date
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      eventsToDelete = await supabaseService.getEvents(
        userId,
        startDate.toISOString(),
        endDate.toISOString()
      );
    } else if (searchQuery) {
      if (searchQuery === "*") {
        // Delete ALL events - use with caution!
        eventsToDelete = await supabaseService.getEvents(userId);
      } else {
        // Search for events using Zep graph and direct search
        try {
          // Search knowledge graph for relevant events
          const graphResults = await zepGraphService.searchEntities(userId,
            `calendar events ${searchQuery}`,
            undefined, // entityType
            50 // limit
          );

          // Also search directly in database
          const allEvents = await supabaseService.getEventsForAgent(userId);
          const matchingEvents = allEvents.filter((event: any) => {
            const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
            return searchText.includes(searchQuery.toLowerCase());
          });

          eventsToDelete = matchingEvents;
          console.log(`🔍 [DELETE-MULTIPLE-EVENTS TOOL] Found ${eventsToDelete.length} events matching: ${searchQuery}`);
        } catch (error) {
          console.error('❌ [DELETE-MULTIPLE-EVENTS TOOL] Search error:', error);
          throw new Error(`Failed to search for events: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else {
      throw new Error("Either date or searchQuery must be provided");
    }

    if (eventsToDelete.length === 0) {
      return "No events found to delete";
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const event of eventsToDelete) {
      const deleteResult = await supabaseService.deleteEvent(userId, event.id);
      if (deleteResult.success) {
        deletedCount++;

        // CRITICAL: Also delete from Zep graph to prevent orphaned nodes
        try {
          await zepGraphService.deleteCalendarEvent(event.id);
        } catch (graphError) {
          console.warn(`⚠️ [DELETE-MULTIPLE-EVENTS TOOL] Failed to remove event from graph (non-critical): ${graphError}`);
          // Non-critical - event is deleted from DB which is what matters
        }
      } else {
        errors.push(`Failed to delete "${event.title}": ${deleteResult.error}`);
      }
    }

    let result = `Deleted ${deletedCount} event(s)`;
    if (errors.length > 0) {
      result += ` (${errors.length} errors occurred)`;
    }

    return result;
  },
  {
    name: "delete_multiple_events",
    description: "Delete multiple events based on date or search criteria. Use this when user wants to delete 'all events on a day' or multiple events matching criteria.",
    schema: z.object({
      date: z.string().optional().describe("Date to delete all events from (ISO format)"),
      searchQuery: z.string().optional().describe("Search query to find multiple events to delete. Use '*' to delete ALL events (dangerous!)"),
    }),
  }
);