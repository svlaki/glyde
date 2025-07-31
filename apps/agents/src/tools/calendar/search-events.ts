import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { EmbeddingService } from "../../services/EmbeddingService.js";

const embeddingService = new EmbeddingService();

export const searchEventsTool = tool(
  async ({ query, limit = 10 }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for searching events");
    }

    const searchResults = await embeddingService.searchSimilarEvents(
      userId,
      query,
      limit
    );

    if (searchResults.length === 0) {
      return `No events found matching: "${query}"`;
    }

    const events = searchResults.map(result => {
      const event = result.metadata;
      const startTime = new Date(event.event_starts_at).toLocaleString();
      return `📅 ${event.event_title} - ${startTime}${event.event_location ? ` at ${event.event_location}` : ''}`;
    });

    return `Found ${events.length} matching events:\n${events.join('\n')}`;
  },
  {
    name: "search_events",
    description: "Search for calendar events using semantic similarity. Useful for finding events by description, title, or context.",
    schema: z.object({
      query: z.string().describe("Search query to find events (e.g. 'workout', 'meeting with John', 'doctor appointment')"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
    }),
  }
);