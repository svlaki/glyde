import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const searchEventsTool = tool(
  async ({ query, category, limit = 10 }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for searching events");
    }

    console.log('🔍 [SEARCH-EVENTS TOOL] Searching with Zep graph:', { query, category, limit });

    try {
      // Use Zep graph service for intelligent event search
      const zepGraphService = new ZepGraphService();

      // Enhance search query with category context if specified
      let enhancedQuery = query;
      if (category) {
        enhancedQuery = `${category} events ${query}`;
      } else {
        enhancedQuery = `calendar events ${query}`;
      }

      // Search knowledge graph for relevant events and context
      const graphResults = await zepGraphService.searchEntities(userId,
        enhancedQuery,
        undefined, // entityType
        limit * 2 // Get more results to filter for events
      );

      // Also get recent events from Supabase as fallback
      const supabaseService = new SupabaseService();
      const recentEvents = await supabaseService.getEventsForAgent(userId);

      // Filter recent events by query relevance and category
      const relevantEvents = recentEvents.filter((event: any) => {
        // Filter by category if specified
        if (category) {
          if (event.category !== category) {
            return false;
          }
        }

        // Search in basic event fields
        const searchText = `${event.title} ${event.description || ''} ${event.location || ''}`.toLowerCase();
        const queryWords = query.toLowerCase().split(' ');
        return queryWords.some((word: string) => searchText.includes(word));
      });

      // Combine and deduplicate results
      const combinedResults: any[] = [];

      // Add graph-based results (these include structured entity data)
      graphResults.forEach((result: any) => {
        if (result.content && result.content.toLowerCase().includes('event')) {
          combinedResults.push({
            source: 'graph',
            content: result.content,
            relevance: result.relevance || 1.0,
            timestamp: result.timestamp
          });
        }
      });

      // Add direct event matches
      relevantEvents.slice(0, limit).forEach((event: any) => {
        const startTime = new Date(event.start_time).toLocaleString();
        const categoryLabel = event.category ? ` [${event.category}]` : '';

        combinedResults.push({
          source: 'database',
          event: event,
          content: `📅 ${event.title} - ${startTime}${event.location ? ` at ${event.location}` : ''}${categoryLabel}`,
          relevance: 1.0,
          timestamp: event.start_time
        });
      });

      // Sort by relevance and limit results
      const finalResults = combinedResults
        .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
        .slice(0, limit);

      if (finalResults.length === 0) {
        const categoryFilter = category ? ` (${category} events)` : '';
        return `No events found matching: "${query}"${categoryFilter}. Try searching with different keywords or check if events exist in your calendar.`;
      }

      // Format results for display
      const formattedResults = finalResults.map((result: any) => {
        if (result.source === 'database' && result.event) {
          return result.content; // Already formatted above
        } else {
          return `🧠 ${result.content}`;
        }
      });

      return `Found ${finalResults.length} matching results:\n${formattedResults.join('\n')}`;

    } catch (error) {
      console.error('❌ [SEARCH-EVENTS TOOL] Error:', error);

      // Fallback to basic Supabase search
      const supabaseService = new SupabaseService();
      const events = await supabaseService.getEventsForAgent(userId);
      const relevantEvents = events.filter((event: any) => {
        const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      }).slice(0, limit);

      if (relevantEvents.length === 0) {
        return `No events found matching: "${query}"`;
      }

      const formattedEvents = relevantEvents.map((event: any) => {
        const startTime = new Date(event.start_time).toLocaleString();
        const categoryLabel = event.category ? ` [${event.category}]` : '';
        return `📅 ${event.title} - ${startTime}${categoryLabel}`;
      });

      return `Found ${relevantEvents.length} matching events (basic search):\n${formattedEvents.join('\n')}`;
    }
  },
  {
    name: "search_events",
    description: "Search for calendar events using semantic similarity and category-based filtering. Find events by description, title, context, or specific categories.",
    schema: z.object({
      query: z.string().describe("Search query to find events. Examples: 'workout', 'meeting with John', 'doctor appointment', 'grocery shopping'"),
      category: z.string().nullable().describe("Filter by specific category. Examples: 'Work', 'School', 'Health & Hygiene', 'Social', 'Fitness'. Leave empty for general search across all categories."),
      limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
    }),
  }
);
