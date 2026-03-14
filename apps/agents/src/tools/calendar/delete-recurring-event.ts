import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";

export const deleteRecurringEventTool = tool(
  async ({ eventId, scope }, config) => {
    const userId = config?.configurable?.userId;

    if (!userId) {
      throw new Error("User ID is required");
    }

    console.log('[DELETE-RECURRING-EVENT TOOL] Starting deletion:', {
      eventId,
      scope
    });

    const supabaseService = new SupabaseService();

    // Get the event
    const events = await supabaseService.getEvents(userId);
    const event = events?.find(e => e.id === eventId);

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    if (!event.is_recurring && !event.parent_event_id) {
      throw new Error(`Event is not recurring. Use regular event deletion instead.`);
    }

    if (scope === 'entire_series') {
      // Delete parent event and all instances
      const parentId = event.parent_event_id || eventId;
      console.log('[DELETE-RECURRING-EVENT TOOL] Deleting entire series:', parentId);

      const success = await supabaseService.deleteRecurringEventSeries(userId, parentId);

      if (!success) {
        throw new Error('Failed to delete recurring series');
      }

      return `Deleted recurring event series and all its instances: "${event.title}"`;
    } else if (scope === 'this_instance') {
      // Delete single instance
      console.log('[DELETE-RECURRING-EVENT TOOL] Deleting single instance:', eventId);

      const success = await supabaseService.deleteRecurringEventInstance(
        userId,
        event.parent_event_id || eventId,
        event.start_time
      );

      if (!success) {
        throw new Error('Failed to delete instance');
      }

      return `Deleted this instance of "${event.title}"`;
    } else if (scope === 'all_future') {
      // End the recurrence just before this instance
      const parentId = event.parent_event_id || eventId;
      const instanceDate = new Date(event.start_time);
      // Set recurrence_end to one day before the instance
      const recurrenceEnd = new Date(instanceDate.getTime() - 86400000).toISOString();

      console.log('[DELETE-RECURRING-EVENT TOOL] Ending series before instance:', recurrenceEnd);

      const updated = await supabaseService.updateRecurringEventSeries(userId, parentId, {
        recurrence_end: recurrenceEnd,
      });

      if (!updated) {
        throw new Error('Failed to update recurrence end date');
      }

      return `Deleted this and all future instances of "${event.title}". The series now ends before ${instanceDate.toLocaleDateString()}.`;
    } else {
      throw new Error(`Invalid scope: ${scope}. Use 'entire_series', 'this_instance', or 'all_future'`);
    }
  },
  {
    name: "delete_recurring_event",
    description: "Delete a recurring event (series, instance, or future).",
    schema: z.object({
      eventId: z.string().describe("Event UUID"),
      scope: z.enum(['entire_series', 'this_instance', 'all_future']).describe("Delete scope"),
    }),
  }
);
