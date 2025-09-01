import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { EmbeddingService } from "../../services/EmbeddingService.js";

const supabaseService = new SupabaseService();
const embeddingService = new EmbeddingService();

export const deleteMultipleEventsTool = tool(
  async ({ date, searchQuery }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for deleting events");
    }

    let eventsToDelete: any[] = [];

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
        // Search for events matching the query
        const searchResults = await embeddingService.searchSimilarEvents(
          userId,
          searchQuery,
          50 // Get more results for bulk deletion
        );
        eventsToDelete = searchResults.map(r => r.metadata);
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
      } else {
        errors.push(`Failed to delete "${event.event_title}": ${deleteResult.error}`);
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
      date: z.string().nullable().describe("Date to delete all events from (ISO format)"),
      searchQuery: z.string().nullable().describe("Search query to find multiple events to delete. Use '*' to delete ALL events (dangerous!)"),
    }),
  }
);