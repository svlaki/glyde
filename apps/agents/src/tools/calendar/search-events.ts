import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const searchEventsTool = tool(
  async ({ query, category, limit }, config) => {
    const userId = config?.configurable?.userId;
    const effectiveLimit = limit ?? 10;

    if (!userId) {
      throw new Error("User ID is required for searching events");
    }

    console.log('🔍 [SEARCH-EVENTS TOOL] Agent-based search:', { query, category, limit: effectiveLimit });

    try {
      const supabaseService = new SupabaseService();
      let events = await supabaseService.getEventsForAgent(userId);

      // Apply category filter if specified
      if (category) {
        events = events.filter((event: any) => event.category === category);
      }

      if (events.length === 0) {
        const categoryFilter = category ? ` in category "${category}"` : '';
        return `No events found${categoryFilter}. The calendar is empty.`;
      }

      // Format all events and let the agent decide which match the query
      const formattedEvents = events.map((event: any) => {
        const startTime = new Date(event.start_time).toLocaleString();
        const categoryLabel = event.category ? ` [${event.category}]` : '';
        const description = event.description ? ` - ${event.description}` : '';
        const location = event.location ? ` at ${event.location}` : '';
        
        return `📅 ${event.title}${description} - ${startTime}${location}${categoryLabel}`;
      });

      // Return events with search context for the agent to filter semantically
      const categoryContext = category ? ` (filtered to category: ${category})` : '';
      return `Found ${events.length} events${categoryContext}. Based on the search query "${query}", here are the matching events:\n\n${formattedEvents.join('\n')}\n\nPlease identify and show the user only the events that match their search query "${query}".`;

    } catch (error) {
      console.error('❌ [SEARCH-EVENTS TOOL] Error:', error);
      throw new Error(`Failed to search events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  {
    name: "search_events",
    description: "Search for calendar events. Returns all events (optionally filtered by category) and relies on the agent to semantically match them to the search query.",
    schema: z.object({
      query: z.string().describe("Search query to find events. The agent will semantically match this against event titles, descriptions, and context."),
      category: z.string().nullable().describe("Optional: Filter by specific category first. Examples: 'Work', 'School', 'Health & Hygiene', 'Social', 'Fitness'."),
      limit: z.number().nullable().optional().describe("Maximum number of results to return (default: 10)"),
    }),
  }
);
