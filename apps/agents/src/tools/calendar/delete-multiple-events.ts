import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { fromZonedTime } from "date-fns-tz";

export const deleteMultipleEventsTool = tool(
  async ({ date, eventIds, clearAll }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone || 'America/Los_Angeles';
    if (!userId) {
      throw new Error("User ID is required for deleting events");
    }

    const supabaseService = new SupabaseService();

    let eventsToDelete: any[] = [];

    console.log('[DELETE-MULTIPLE-EVENTS TOOL] Processing bulk deletion:', { date, eventIds, clearAll });

    if (clearAll) {
      // Delete ALL events — use getRawEvents to get actual DB records
      eventsToDelete = await supabaseService.getRawEvents(userId);
    } else if (date) {
      // Delete all events on a specific date — use getEvents() to include recurring instances
      // Convert naive local date to UTC range covering the full local day
      const dayStart = date.includes('T') ? date : `${date}T00:00:00`;
      const dayEndStr = date.includes('T') ? date : `${date}T00:00:00`;
      const dayEndDate = new Date(dayEndStr);
      dayEndDate.setDate(dayEndDate.getDate() + 1);
      const dayEndLocal = dayEndDate.toISOString().split('T')[0] + 'T00:00:00';

      const utcStart = fromZonedTime(dayStart, timezone).toISOString();
      const utcEnd = fromZonedTime(dayEndLocal, timezone).toISOString();

      eventsToDelete = await supabaseService.getEvents(
        userId,
        utcStart,
        utcEnd
      );
    } else if (eventIds && eventIds.length > 0) {
      // Delete specific events by ID
      const allEvents = await supabaseService.getEvents(userId);
      eventsToDelete = allEvents.filter((event: any) => eventIds.includes(event.id));
    } else {
      throw new Error("Provide date, eventIds, or clearAll");
    }

    if (eventsToDelete.length === 0) {
      return "No events found to delete";
    }

    console.log(`[DELETE-MULTIPLE-EVENTS TOOL] Deleting ${eventsToDelete.length} events`);

    let deletedCount = 0;
    const errors: string[] = [];
    const deletedParentIds = new Set<string>();

    for (const event of eventsToDelete) {
      // Handle recurring event instances — delete just this instance
      if (event.is_instance && event.parent_event_id) {
        if (deletedParentIds.has(event.parent_event_id)) continue;

        const instanceDate = event.instance_date || event.start_time;
        const success = await supabaseService.deleteRecurringEventInstance(
          userId,
          event.parent_event_id,
          instanceDate
        );
        if (success) {
          deletedCount++;
        } else {
          errors.push(`Failed to delete instance of "${event.title}" on ${instanceDate}`);
        }
      } else {
        // Regular event — delete the DB record
        if (deletedParentIds.has(event.id)) continue;

        const deleteResult = await supabaseService.deleteEvent(userId, event.id, { source: 'agent', agentType: 'conversation' });
        if (deleteResult.success) {
          deletedCount++;
          deletedParentIds.add(event.id);
        } else {
          errors.push(`Failed to delete "${event.title}": ${deleteResult.error}`);
        }
      }
    }

    let result = `Deleted ${deletedCount} event(s)`;
    if (errors.length > 0) {
      result += ` (${errors.length} errors occurred)`;
    }

    return result;
  },
  {
    name: "delete_multiple_events",
    description: "Delete multiple events by date, IDs, or clear all. Get #IDs from CALENDAR context or search_events.",
    schema: z.object({
      date: z.string().optional().nullable().describe("Date ISO to delete all events from that day"),
      eventIds: z.array(z.string()).optional().nullable().describe("Event UUIDs to delete"),
      clearAll: z.boolean().optional().nullable().describe("Delete ALL events (use with caution)"),
    }),
  }
);
