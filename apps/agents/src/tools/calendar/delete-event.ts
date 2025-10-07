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

    // If no eventId provided, search for the event using improved fuzzy search
    if (!targetEventId) {
      if (!searchQuery) {
        throw new Error("Either eventId or searchQuery must be provided");
      }

      console.log('🔍 [DELETE-EVENT TOOL] Searching for event to delete:', searchQuery);

      try {
        // Search directly in database with improved fuzzy matching
        const events = await supabaseService.getEventsForAgent(userId);
        
        // Normalize search query - remove common words and split
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word => 
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at'].includes(word)
        );

        // Find matching events with fuzzy logic
        const matchingEvents = events.filter((event: any) => {
          const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
          
          // Check if any significant query words are in the event text
          const hasMatch = queryWords.some(word => searchText.includes(word));
          
          // Or check if the search text contains the full query
          const hasFullMatch = searchText.includes(normalizedQuery);
          
          return hasMatch || hasFullMatch;
        });

        // Sort by relevance - prefer title matches over description matches
        matchingEvents.sort((a, b) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();
          
          // Check how many query words match in title
          const aMatches = queryWords.filter(word => aTitle.includes(word)).length;
          const bMatches = queryWords.filter(word => bTitle.includes(word)).length;
          
          return bMatches - aMatches;
        });

        if (matchingEvents.length > 0) {
          targetEventId = matchingEvents[0].id;
          console.log('✅ [DELETE-EVENT TOOL] Found event to delete:', matchingEvents[0].title);
        } else {
          // Try graph search as fallback
          const graphResults = await zepGraphService.searchEntities(userId,
            `calendar event ${searchQuery}`,
            undefined,
            5
          );
          
          if (graphResults.length > 0) {
            // Try to extract event ID from graph results
            console.log('📊 [DELETE-EVENT TOOL] Found in graph, searching events again with broader criteria');
          }
          
          throw new Error(`No event found matching: "${searchQuery}". Available events: ${events.map(e => e.title).join(', ')}`);
        }
      } catch (error) {
        console.error('❌ [DELETE-EVENT TOOL] Search error:', error);
        throw new Error(`Failed to find event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!targetEventId) {
      throw new Error("Failed to identify event to delete - this should not happen");
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
    description: "Delete a calendar event by searching for it with a text query. Finds the event using fuzzy matching on title and description.",
    schema: z.object({
      eventId: z.string().optional().describe("Event ID to delete (optional - rarely used, prefer searchQuery)"),
      searchQuery: z.string().describe("Search query to find and delete the event. Examples: 'cs 221', 'meeting with john', 'workout'. The tool will fuzzy match against event titles and descriptions."),
    }),
  }
);