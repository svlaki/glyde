import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { EmbeddingService } from "../../services/EmbeddingService.js";

const supabaseService = new SupabaseService();
const embeddingService = new EmbeddingService();

export const updateEventTool = tool(
  async ({ eventId, searchQuery, title, startTime, endTime, location, description }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for updating events");
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

    const updatedEvent = await supabaseService.updateEvent(
      userId,
      targetEventId,
      {
        event_title: title || undefined,
        event_starts_at: startTime || undefined,
        event_ends_at: endTime || undefined,
        event_location: location || undefined,
        event_description: description || undefined,
      }
    );

    if (!updatedEvent) {
      throw new Error("Failed to update event");
    }

    return `✅ Updated event: "${title || 'Event'}"`;
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