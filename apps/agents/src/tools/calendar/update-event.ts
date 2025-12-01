import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { CategoryService } from "../../services/CategoryService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const updateEventTool = tool(
  async ({ eventId, searchQuery, title, startTime, endTime, location, description, category }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      return "❌ User ID is required for updating events. Please try again.";
    }
    if (!timezone) {
      return "❌ Timezone is required for updating events. Please try again.";
    }

    let targetEventId = eventId;

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const categoryService = new CategoryService();

    // If no eventId provided, search for the event using Zep and direct search
    if (!targetEventId && searchQuery) {
      console.log('[UPDATE-EVENT TOOL] Searching for event to update:', searchQuery);

      try {
        // Get all events and filter to recent ones (today + 14 days)
        const allEvents = await supabaseService.getEvents(userId);
        const now = new Date();
        const todayStart = new Date(now.toISOString().split('T')[0]);

        // Include events from today onwards only
        const recentEvents = allEvents.filter((event: any) => {
          const eventDate = new Date(event.start_time);
          return eventDate >= todayStart;
        });

        // Find matching events using fuzzy matching
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word =>
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at'].includes(word)
        );

        const matchingEvents = recentEvents.filter((event: any) => {
          const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
          const hasMatch = queryWords.some(word => searchText.includes(word));
          const hasFullMatch = searchText.includes(normalizedQuery);
          return hasMatch || hasFullMatch;
        });

        if (matchingEvents.length > 0) {
          targetEventId = matchingEvents[0].id;
          console.log('✅ [UPDATE-EVENT TOOL] Found event to update:', matchingEvents[0].title);
        } else {
          return `❌ No event found matching: "${searchQuery}". Please check the event name and try again.`;
        }

        if (matchingEvents.length > 1) {
          // Multiple matches - ask for clarification
          const eventsList = matchingEvents.slice(0, 5).map(e => {
            const eventDate = new Date(e.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `- ${e.title} on ${eventDate} at ${new Date(e.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
          }).join('\n');

          throw new Error(`Found ${matchingEvents.length} events matching "${searchQuery}". Which one should I update?\n${eventsList}`);
        }

        targetEventId = matchingEvents[0].id;
        console.log('[UPDATE-EVENT TOOL] Found event to update:', matchingEvents[0].title);
      } catch (error) {
        console.error('❌ [UPDATE-EVENT TOOL] Search error:', error);
        return `❌ Failed to find event: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    if (!targetEventId) {
      return "❌ No event ID provided and no search query given. Please specify which event to update.";
    }

    // Get original event to compare changes
    const events = await supabaseService.getEvents(userId);
    const originalEvent = events.find((e: any) => e.id === targetEventId);

    // Convert local times to UTC for storage (same as create-event)
    const startTimeUTC = startTime ? convertToUTC(startTime, timezone) : undefined;
    const endTimeUTC = endTime ? convertToUTC(endTime, timezone) : undefined;

    if (startTimeUTC || endTimeUTC) {
      console.log(`[UPDATE-EVENT TOOL] Timezone conversion - ${startTime} -> ${startTimeUTC}`);
    }

    const updatedEvent = await supabaseService.updateEvent(
      userId,
      targetEventId,
      {
        title: title || undefined,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        location: location || undefined,
        description: description || undefined,
        category: category || undefined,
      }
    );

    if (!updatedEvent) {
      // Return error message instead of throwing to prevent LLM retry loops
      return "❌ Failed to update event. The event may have been deleted or you may not have permission to modify it.";
    }

    // Note: Automatic graph sync disabled to prevent Zep graph bloat
    // Individual event updates create too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement selective sync only for significant events or via periodic aggregation

    // Build detailed change description
    const changes: string[] = [];
    const eventTitle = title || updatedEvent.title || originalEvent?.title || 'Event';

    if (title && originalEvent?.title !== title) {
      changes.push(`renamed to "${title}"`);
    }
    if (startTimeUTC || endTimeUTC) {
      const newStartDate = new Date(updatedEvent.start_time);
      const newEndDate = new Date(updatedEvent.end_time);
      const dateStr = newStartDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const startTimeStr = newStartDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTimeStr = newEndDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      changes.push(`moved to ${dateStr} from ${startTimeStr} to ${endTimeStr}`);
    }
    if (category && originalEvent?.category !== category) {
      changes.push(`category changed to "${category}"`);
    }
    if (location && originalEvent?.location !== location) {
      changes.push(`location changed to "${location}"`);
    }

    const changeDescription = changes.length > 0 ? ` - ${changes.join(', ')}` : '';

    return `✅ EVENT: "${eventTitle}" has been updated${changeDescription}`;
  },
  {
    name: "update_event",
    description: "Update an existing calendar event. If eventId is not provided, use semantic search to find the event by description. Can update event category and details.",
    schema: z.object({
      eventId: z.string().optional().describe("Event ID to update (optional - if not provided, search by description)"),
      searchQuery: z.string().optional().describe("Search query to find the event if eventId is not provided (e.g., 'grocery trip', 'meeting with John', 'workout yesterday')"),
      title: z.string().optional().describe("New event title - leave empty to keep existing"),
      startTime: z.string().optional().describe("New start time in ISO format - leave empty to keep existing"),
      endTime: z.string().optional().describe("New end time in ISO format - leave empty to keep existing"),
      location: z.string().optional().describe("New event location - leave empty to keep existing"),
      description: z.string().optional().describe("New event description - leave empty to keep existing"),
      category: z.string().optional().describe("Update event category (e.g., 'Work', 'School', 'Health & Hygiene', 'Social', 'Personal'). Leave empty to keep existing category."),
    }),
  }
);