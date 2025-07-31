import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { EmbeddingService } from "../../services/EmbeddingService.js";

const supabaseService = new SupabaseService();
const embeddingService = new EmbeddingService();

export const deleteEventTool = tool(
  async ({ eventId, searchQuery }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for deleting events");
    }

    let targetEventId = eventId;

    // If no eventId provided, search for the event semantically
    if (!targetEventId && searchQuery) {
      const searchResults = await embeddingService.searchSimilarEvents(
        userId,
        searchQuery,
        1
      );
      
      if (searchResults.length > 0) {
        targetEventId = searchResults[0].metadata.id;
      } else {
        throw new Error(`No event found matching: "${searchQuery}"`);
      }
    }

    if (!targetEventId) {
      throw new Error("No event ID provided and no search query given");
    }

    const deleteResult = await supabaseService.deleteEvent(userId, targetEventId);

    if (!deleteResult.success) {
      throw new Error(`Failed to delete event: ${deleteResult.error}`);
    }

    return `✅ Deleted event successfully`;
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