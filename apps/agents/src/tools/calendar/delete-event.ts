import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { formatTimeForUser } from "../../utils/timezoneUtils.js";

export const deleteEventTool = tool(
  async ({ eventId }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone || 'America/Los_Angeles';
    if (!userId) {
      throw new Error("User ID is required for deleting events");
    }

    // Strip '#' prefix if LLM included it from CALENDAR context
    eventId = typeof eventId === 'string' ? eventId.replace(/^#/, '').trim() : eventId;

    const supabaseService = new SupabaseService();

    // Look up the event (expanded) to check if it's a recurring instance
    const allEvents = await supabaseService.getEvents(userId);
    const eventToDelete = allEvents.find((e: any) => e.id === eventId);
    const eventTitle = eventToDelete?.title || 'Unknown event';

    // Handle recurring event instance — delete just this occurrence
    if (eventToDelete?.is_instance && eventToDelete?.parent_event_id) {
      console.log(`[DELETE-EVENT TOOL] Deleting recurring instance for date: ${eventToDelete.instance_date}`);

      const instanceDeleted = await supabaseService.deleteRecurringEventInstance(
        userId,
        eventToDelete.parent_event_id,
        eventToDelete.instance_date || eventToDelete.start_time
      );

      if (!instanceDeleted) {
        throw new Error('Failed to delete recurring event instance');
      }

      let timeInfo = '';
      if (eventToDelete.start_time) {
        const dateStr = formatTimeForUser(eventToDelete.start_time, timezone, 'EEEE, MMMM d');
        const timeStr = formatTimeForUser(eventToDelete.start_time, timezone, 'h:mm a');
        timeInfo = ` on ${dateStr} at ${timeStr}`;
      }

      return `EVENT: Deleted this instance of recurring event "${eventTitle}"${timeInfo}. Other occurrences remain unchanged. To delete the entire series, use delete_recurring_event with scope 'entire_series'.`;
    }

    // Regular event deletion
    const deleteResult = await supabaseService.deleteEvent(userId, eventId, { source: 'agent', agentType: 'conversation' });

    if (!deleteResult.success) {
      throw new Error(`Failed to delete event: ${deleteResult.error}`);
    }

    console.log(`[DELETE-EVENT TOOL] Event "${eventTitle}" deleted successfully`);

    let timeInfo = '';
    if (eventToDelete?.start_time) {
      const dateStr = formatTimeForUser(eventToDelete.start_time, timezone, 'EEEE, MMMM d');
      const timeStr = formatTimeForUser(eventToDelete.start_time, timezone, 'h:mm a');
      timeInfo = ` from ${dateStr} at ${timeStr}`;
    }

    return `EVENT: "${eventTitle}" has been deleted${timeInfo}`;
  },
  {
    name: "delete_event",
    description: "Delete an event by ID. Get the #ID from your CALENDAR context or from search_events.",
    schema: z.object({
      eventId: z.string().describe("Event UUID from CALENDAR context (#ID) or search_events results"),
    }),
  }
);
