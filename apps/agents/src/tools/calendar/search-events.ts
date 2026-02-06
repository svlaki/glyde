import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const searchEventsTool = tool(
  async ({ query, aspect, limit, includePast }, config) => {
    const userId = config?.configurable?.userId;
    const effectiveLimit = limit ?? 10;

    if (!userId) {
      throw new Error("User ID is required for searching events");
    }

    console.log('🔍 [SEARCH-EVENTS TOOL] Agent-based search:', { query, aspect, limit: effectiveLimit, includePast });

    try {
      const supabaseService = new SupabaseService();
      let events = await supabaseService.getExpandedEvents(userId);

      // Filter out past events unless includePast is true (includes ongoing multi-day events)
      if (!includePast) {
        const now = new Date();
        events = events.filter((event: any) => new Date(event.end_time) >= now);
        console.log(`🔍 [SEARCH-EVENTS TOOL] Filtered to ${events.length} future/ongoing events`);
      }

      // Apply aspect filter if specified (case-insensitive, strips emoji icons)
      if (aspect) {
        const normalizedAspect = aspect.replace(/[\p{Emoji}\s]+/gu, '').trim().toLowerCase();
        events = events.filter((event: any) => {
          const eventAspect = (event.aspect || '').toLowerCase();
          return eventAspect === normalizedAspect || eventAspect.includes(normalizedAspect);
        });
      }

      if (events.length === 0) {
        const aspectFilter = aspect ? ` in aspect "${aspect}"` : '';
        return `No events found${aspectFilter}. The calendar is empty.`;
      }

      // Format all events and let the agent decide which match the query
      const formattedEvents = events.map((event: any) => {
        const startTime = new Date(event.start_time).toLocaleString();
        const aspectLabel = event.aspect ? ` [${event.aspect}]` : '';
        const description = event.description ? ` - ${event.description}` : '';
        const location = event.location ? ` at ${event.location}` : '';

        return `${event.title}${description} - ${startTime}${location}${aspectLabel}\n   ID: ${event.id}`;
      });

      // Return events with search context for the agent to filter semantically
      const aspectContext = aspect ? ` (filtered to aspect: ${aspect})` : '';
      return `Found ${events.length} events${aspectContext}. Based on the search query "${query}", here are the matching events:\n\n${formattedEvents.join('\n')}\n\nPlease identify and show the user only the events that match their search query "${query}".`;

    } catch (error) {
      console.error('[SEARCH-EVENTS TOOL] Error:', error);
      throw new Error(`Failed to search events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  {
    name: "search_events",
    description: "Search for calendar events. By default shows only future/ongoing events. Use includePast=true to search historical events. Returns events (optionally filtered by aspect) and relies on the agent to semantically match them to the search query.",
    schema: z.object({
      query: z.string().describe("Search query to find events. The agent will semantically match this against event titles, descriptions, and context."),
      aspect: z.string().optional().nullable().describe("Optional: Filter by specific aspect first. Examples: 'Work', 'School', 'Health & Hygiene', 'Social', 'Fitness'."),
      limit: z.number().optional().nullable().describe("Maximum number of results to return (default: 10)"),
      includePast: z.boolean().optional().nullable().describe("Optional: Set to true to include past events in search. Default is false (only future/ongoing events). Use true when user asks about history like 'What did I do last week?'"),
    }),
  }
);
