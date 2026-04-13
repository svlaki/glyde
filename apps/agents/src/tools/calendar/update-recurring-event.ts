import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { convertToUTC, formatEventTime } from "../../utils/timezoneUtils.js";

export const updateRecurringEventTool = tool(
  async ({ eventId, scope, title, description, location, startTime }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      throw new Error("User ID is required");
    }

    eventId = typeof eventId === 'string' ? eventId.replace(/^#/, '').trim() : eventId;

    console.log('[UPDATE-RECURRING-EVENT TOOL] Starting update:', {
      eventId,
      scope,
      title,
      timezone
    });

    const supabaseService = new SupabaseService();

    // Get the event
    const events = await supabaseService.getEvents(userId);
    const event = events?.find(e => e.id === eventId);

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    if (!event.is_recurring) {
      throw new Error(`Event is not recurring. Use regular event update instead.`);
    }

    // Prepare update data
    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (startTime) {
      const newStartUTC = convertToUTC(startTime, timezone);
      updateData.start_time = newStartUTC;
      // Preserve duration
      const duration = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
      updateData.end_time = new Date(new Date(newStartUTC).getTime() + duration).toISOString();
    }

    if (scope === 'entire_series') {
      // Update parent event
      console.log('[UPDATE-RECURRING-EVENT TOOL] Updating entire series:', eventId);

      const updated = await supabaseService.updateRecurringEventSeries(userId, eventId, updateData);

      if (!updated) {
        throw new Error('Failed to update recurring series');
      }

      return `Updated recurring event series: "${updated.title}"`;
    } else if (scope === 'this_instance') {
      // Update single instance via exception override
      const parentId = event.parent_event_id || eventId;
      console.log('[UPDATE-RECURRING-EVENT TOOL] Updating single instance:', eventId, 'parent:', parentId);

      const updated = await supabaseService.updateRecurringEventInstance(
        userId,
        parentId,
        event.start_time,
        updateData
      );

      if (!updated) {
        throw new Error('Failed to update recurring event instance');
      }

      return `Updated this instance of "${event.title}"`;
    } else {
      throw new Error(`Invalid scope: ${scope}. Use 'entire_series' or 'this_instance'`);
    }
  },
  {
    name: "update_recurring_event",
    description: "Update a recurring event (series or instance).",
    schema: z.object({
      eventId: z.string().describe("Event UUID"),
      scope: z.enum(['entire_series', 'this_instance']).describe("Update scope"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      location: z.string().optional().describe("New location"),
      startTime: z.string().optional().describe("New start time ISO"),
    }),
  }
);
