import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

// Helper function to get archetype emoji
function getArchetypeEmoji(archetype?: string): string {
  switch (archetype) {
    case 'grocery': return '🛒';
    case 'meeting': return '👥';
    case 'workout': return '💪';
    case 'appointment': return '🏥';
    case 'travel': return '✈️';
    case 'work_focus': return '💻';
    case 'personal': return '👨‍👩‍👧‍👦';
    default: return '📅';
  }
}

// Helper function to format archetype data for display
function formatArchetypeData(archetype?: string, data?: any): string {
  if (!data || typeof data !== 'object') return '';

  switch (archetype) {
    case 'grocery':
      if (data.items && Array.isArray(data.items)) {
        const itemCount = data.items.length;
        const completedCount = data.items.filter((item: any) => item.completed).length;
        return ` (${completedCount}/${itemCount} items)`;
      }
      break;
    case 'meeting':
      if (data.attendees && Array.isArray(data.attendees)) {
        return ` (${data.attendees.length} attendees)`;
      }
      break;
    case 'workout':
      if (data.exercises && Array.isArray(data.exercises)) {
        return ` (${data.exercises.length} exercises)`;
      }
      break;
    case 'appointment':
      if (data.provider) {
        return ` (${data.provider})`;
      }
      break;
    case 'travel':
      if (data.destination) {
        return ` (to ${data.destination})`;
      }
      break;
    case 'work_focus':
      if (data.tasks && Array.isArray(data.tasks)) {
        const taskCount = data.tasks.length;
        const completedCount = data.tasks.filter((task: any) => task.completed).length;
        return ` (${completedCount}/${taskCount} tasks)`;
      }
      break;
  }
  return '';
}

export const searchEventsTool = tool(
  async ({ query, archetype, limit = 10 }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for searching events");
    }

    console.log('🔍 [SEARCH-EVENTS TOOL] Searching with Zep graph:', { query, archetype, limit });

    try {
      // Use Zep graph service for intelligent event search
      const zepGraphService = new ZepGraphService();

      // Enhance search query with archetype context if specified
      let enhancedQuery = query;
      if (archetype && archetype !== 'generic') {
        enhancedQuery = `${archetype} events ${query}`;
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

      // Filter recent events by query relevance and archetype
      const relevantEvents = recentEvents.filter((event: any) => {
        // Filter by archetype if specified
        if (archetype && archetype !== 'generic') {
          if (event.archetype !== archetype) {
            return false;
          }
        }

        // Search in basic event fields
        const searchText = `${event.event_title} ${event.event_description || ''} ${event.event_location || ''}`.toLowerCase();
        const queryWords = query.toLowerCase().split(' ');
        const basicMatch = queryWords.some((word: string) => searchText.includes(word));

        // Also search within archetype_data if it exists
        let archetypeMatch = false;
        if (event.archetype_data) {
          const archetypeText = JSON.stringify(event.archetype_data).toLowerCase();
          archetypeMatch = queryWords.some((word: string) => archetypeText.includes(word));
        }

        return basicMatch || archetypeMatch;
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

      // Add direct event matches with archetype details
      relevantEvents.slice(0, limit).forEach((event: any) => {
        const startTime = new Date(event.event_starts_at).toLocaleString();

        // Get archetype emoji and details
        const archetypeEmoji = getArchetypeEmoji(event.archetype);
        let archetypeDetails = '';
        if (event.archetype_data && Object.keys(event.archetype_data).length > 0) {
          archetypeDetails = formatArchetypeData(event.archetype, event.archetype_data);
        }

        combinedResults.push({
          source: 'database',
          event: event,
          content: `${archetypeEmoji} ${event.event_title} - ${startTime}${event.event_location ? ` at ${event.event_location}` : ''}${archetypeDetails}`,
          relevance: 1.0,
          timestamp: event.event_starts_at
        });
      });

      // Sort by relevance and limit results
      const finalResults = combinedResults
        .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
        .slice(0, limit);

      if (finalResults.length === 0) {
        const archetypeFilter = archetype ? ` (${archetype} events)` : '';
        return `No events found matching: "${query}"${archetypeFilter}. Try searching with different keywords or check if events exist in your calendar.`;
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
        const searchText = `${event.event_title} ${event.event_description || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      }).slice(0, limit);

      if (relevantEvents.length === 0) {
        return `No events found matching: "${query}"`;
      }

      const formattedEvents = relevantEvents.map((event: any) => {
        const startTime = new Date(event.event_starts_at).toLocaleString();
        return `📅 ${event.event_title} - ${startTime}`;
      });

      return `Found ${relevantEvents.length} matching events (basic search):\n${formattedEvents.join('\n')}`;
    }
  },
  {
    name: "search_events",
    description: "Search for calendar events using semantic similarity and archetype-based filtering. Find events by description, title, context, or specific event types. Can search within structured archetype data (e.g., grocery items, meeting attendees, workout exercises).",
    schema: z.object({
      query: z.string().describe("Search query to find events. Examples: 'workout', 'meeting with John', 'doctor appointment', 'milk' (searches in grocery items), 'squats' (searches in workout exercises), 'Sarah' (searches in meeting attendees)"),
      archetype: z.enum(['grocery', 'meeting', 'workout', 'appointment', 'travel', 'work_focus', 'personal', 'generic']).optional()
        .describe("Filter by specific event type. Use this when user asks for specific types like 'show me all my workouts' (workout), 'find grocery trips' (grocery), 'list meetings' (meeting), etc. Leave empty for general search across all event types."),
      limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
    }),
  }
);