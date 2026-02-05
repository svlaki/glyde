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
        // Get all events and filter to upcoming ones
        // We include ALL future events to ensure "tomorrow" events are found regardless of timezone
        const allEvents = await supabaseService.getEventsForAgent(userId);
        const now = new Date();

        // Use current UTC time minus 24 hours to ensure we don't miss events
        // that might appear as "today" in the user's timezone but are technically
        // "yesterday" in UTC (e.g., late night events in US timezones)
        const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        console.log(`🔍 [DELETE-EVENT TOOL] Filtering events from ${cutoffTime.toISOString()} onwards`);
        console.log(`🔍 [DELETE-EVENT TOOL] Total events before filter: ${allEvents.length}`);

        // Include events from cutoff onwards (gives 24h buffer for timezone differences)
        const recentEvents = allEvents.filter((event: any) => {
          const eventDate = new Date(event.start_time);
          return eventDate >= cutoffTime;
        });

        console.log(`🔍 [DELETE-EVENT TOOL] Searching in ${recentEvents.length} recent events`);

        // Normalize search query - remove common words and split
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word =>
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at'].includes(word)
        );

        // Find matching events with fuzzy logic
        const matchingEvents = recentEvents.filter((event: any) => {
          const searchText = `${event.title} ${event.description || ''}`.toLowerCase();

          // Check if any significant query words are in the event text
          const hasMatch = queryWords.some(word => searchText.includes(word));

          // Or check if the search text contains the full query
          const hasFullMatch = searchText.includes(normalizedQuery);

          return hasMatch || hasFullMatch;
        });

        // Sort by relevance - prefer title matches and sooner dates
        matchingEvents.sort((a, b) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();

          // Check how many query words match in title
          const aMatches = queryWords.filter(word => aTitle.includes(word)).length;
          const bMatches = queryWords.filter(word => bTitle.includes(word)).length;

          // If match counts are equal, sort by date (sooner first)
          if (bMatches === aMatches) {
            return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          }
          return bMatches - aMatches;
        });

        if (matchingEvents.length === 0) {
          // Check if there are older matching events
          const olderMatches = allEvents.filter((event: any) => {
            const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
            const hasMatch = queryWords.some(word => searchText.includes(word));
            const hasFullMatch = searchText.includes(normalizedQuery);
            return (hasMatch || hasFullMatch) && new Date(event.start_time) < now;
          });

          if (olderMatches.length > 0) {
            throw new Error(`No upcoming events found matching "${searchQuery}". I found ${olderMatches.length} older event(s) with that name. Did you mean one of those? Please specify the date if you want to delete an old event.`);
          }

          throw new Error(`No events found matching: "${searchQuery}". Recent events: ${recentEvents.map(e => e.title).join(', ')}`);
        }

        if (matchingEvents.length > 1) {
          // Multiple matches - ask for clarification
          const eventsList = matchingEvents.slice(0, 5).map(e => {
            const eventDate = new Date(e.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `- ${e.title} on ${eventDate} at ${new Date(e.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
          }).join('\n');

          throw new Error(`Found ${matchingEvents.length} events matching "${searchQuery}". Which one should I delete?\n${eventsList}`);
        }

        targetEventId = matchingEvents[0].id;
        console.log('[DELETE-EVENT TOOL] Found event to delete:', matchingEvents[0].title);
      } catch (error) {
        console.error('[DELETE-EVENT TOOL] Search error:', error);
        throw new Error(`Failed to find event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!targetEventId) {
      throw new Error("Failed to identify event to delete - this should not happen");
    }

    // Get event details before deletion for response
    const allEvents = await supabaseService.getEvents(userId);
    const eventToDelete = allEvents.find((e: any) => e.id === targetEventId);

    const eventTitle = eventToDelete?.title || 'Unknown event';

    // Check if this is a recurring event instance
    if (eventToDelete?.is_instance && eventToDelete?.parent_event_id) {
      // Delete just this instance of the recurring event
      console.log(`[DELETE-EVENT TOOL] Deleting recurring instance for date: ${eventToDelete.instance_date}`);

      const instanceDeleted = await supabaseService.deleteRecurringEventInstance(
        userId,
        eventToDelete.parent_event_id,
        eventToDelete.instance_date || eventToDelete.start_time
      );

      if (!instanceDeleted) {
        throw new Error(`Failed to delete recurring event instance`);
      }

      console.log(`[DELETE-EVENT TOOL] Recurring instance "${eventTitle}" deleted successfully`);

      // Format event time for response
      let timeInfo = '';
      if (eventToDelete?.start_time) {
        const startDate = new Date(eventToDelete.start_time);
        const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const timeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        timeInfo = ` on ${dateStr} at ${timeStr}`;
      }

      return `EVENT: Deleted this instance of recurring event "${eventTitle}"${timeInfo}. Other occurrences remain unchanged. To delete the entire series, use delete_recurring_event with scope 'entire_series'.`;
    }

    // Regular event deletion
    const deleteResult = await supabaseService.deleteEvent(userId, targetEventId, { source: 'agent', agentType: 'conversation' });

    if (!deleteResult.success) {
      throw new Error(`Failed to delete event: ${deleteResult.error}`);
    }

    console.log(`[DELETE-EVENT TOOL] Event "${eventTitle}" deleted successfully from database`);

    // Remove from knowledge graph asynchronously (fire-and-forget for speed)
    const removeFromGraph = async () => {
      try {
        console.log('[DELETE-EVENT TOOL] Removing from knowledge graph (async)...');

        await zepGraphService.deleteCalendarEvent(userId, targetEventId, eventTitle);

        console.log(`[DELETE-EVENT TOOL] Event removed from knowledge graph`);
      } catch (error) {
        console.error('[DELETE-EVENT TOOL] Failed to remove event from knowledge graph (non-critical):', error);
      }
    };

    // Fire and forget - don't await this
    removeFromGraph();

    // Format event time for response
    let timeInfo = '';
    if (eventToDelete?.start_time) {
      const startDate = new Date(eventToDelete.start_time);
      const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const timeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      timeInfo = ` from ${dateStr} at ${timeStr}`;
    }

    return `EVENT: "${eventTitle}" has been deleted${timeInfo}`;
  },
  {
    name: "delete_event",
    description: "Delete a calendar event by searching for it with a text query. Finds the event using fuzzy matching on title and description.",
    schema: z.object({
      eventId: z.string().optional().nullable().describe("Event ID to delete (optional - rarely used, prefer searchQuery)"),
      searchQuery: z.string().describe("Search query to find and delete the event. Examples: 'cs 221', 'meeting with john', 'workout'. The tool will fuzzy match against event titles and descriptions."),
    }),
  }
);