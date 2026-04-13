import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { AspectService } from "../../services/AspectService.js";
import { convertToUTC, formatTimeForUser } from "../../utils/timezoneUtils.js";
import reminderService from "../../services/ReminderService.js";

export const updateEventTool = tool(
  async ({ eventId, title, startTime, endTime, location, description, aspect, reflection, isMissed, reminderMinutes }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      return "User ID is required for updating events. Please try again.";
    }
    if (!timezone) {
      return "Timezone is required for updating events. Please try again.";
    }

    const supabaseService = new SupabaseService();
    const aspectService = new AspectService();

    // Strip '#' prefix if the LLM included it from CALENDAR context formatting
    let targetEventId = typeof eventId === 'string' ? eventId.replace(/^#/, '').trim() : eventId;

    // Get original event to compare changes
    const events = await supabaseService.getEvents(userId);
    const originalEvent = events.find((e: any) => e.id === targetEventId);

    // Check if this is a recurring event instance
    if (originalEvent?.is_instance && originalEvent?.parent_event_id) {
      console.log(`[UPDATE-EVENT TOOL] Detected recurring event instance`);

      // For time changes on a recurring instance, guide user to use update_recurring_event
      if (startTime || endTime) {
        const instanceDate = new Date(originalEvent.start_time).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric'
        });
        return `"${originalEvent.title}" on ${instanceDate} is part of a recurring series. To change the time:\n` +
          `- To reschedule just THIS instance: Use update_recurring_event with scope 'this_instance'\n` +
          `- To reschedule ALL instances: Use update_recurring_event with scope 'entire_series'\n\n` +
          `I can update the title, description, location, or aspect for the entire series if you'd like.`;
      }

      // Reflection and is_missed are per-instance — create an override event for this instance
      if (reflection !== undefined || isMissed !== undefined) {
        console.log(`[UPDATE-EVENT TOOL] Per-instance update (reflection/missed) for recurring instance`);
        const instanceUpdates: any = {};
        if (reflection !== undefined) instanceUpdates.reflection = reflection;
        if (isMissed !== undefined) instanceUpdates.is_missed = isMissed;

        const updatedInstance = await supabaseService.updateRecurringEventInstance(
          userId,
          originalEvent.parent_event_id,
          originalEvent.start_time,
          instanceUpdates
        );
        if (updatedInstance) {
          const parts: string[] = [];
          if (reflection !== undefined) parts.push('reflection updated');
          if (isMissed !== undefined) parts.push(isMissed ? 'marked as missed' : 'marked as attended');
          return `EVENT: "${originalEvent.title}" - ${parts.join(', ')} (this instance only)`;
        }
        return "Failed to update recurring event instance.";
      }

      // For metadata changes (title, description, location, aspect), update the parent (affects all instances)
      console.log(`[UPDATE-EVENT TOOL] Updating parent recurring event: ${originalEvent.parent_event_id}`);
      targetEventId = originalEvent.parent_event_id;
    }

    // Validate that aspect exists before updating
    if (aspect && aspect.trim().length > 0) {
      console.log(`[UPDATE-EVENT TOOL] Validating aspect: "${aspect}"`);
      const existingAspect = await aspectService.getAspectByName(userId, aspect.trim());

      if (!existingAspect) {
        const allAspects = await aspectService.getAspects(userId);
        const aspectNames = allAspects.map(a => a.name).join(', ');
        return `Aspect "${aspect}" does not exist. Available aspects: [${aspectNames}]. Use an existing aspect or ask the user to create one first with create_aspect.`;
      }
    }

    // Convert local times to UTC for storage
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
        aspect: aspect || undefined,
        reflection: reflection !== undefined && reflection !== null ? reflection : undefined,
        is_missed: isMissed !== undefined && isMissed !== null ? isMissed : undefined,
        reminder_minutes: reminderMinutes !== undefined
          ? (reminderMinutes != null
            ? (Array.isArray(reminderMinutes) ? reminderMinutes : [reminderMinutes])
            : null)
          : undefined,
      },
      { source: 'agent', agentType: 'conversation' }
    );

    if (!updatedEvent) {
      return "Failed to update event. The event may have been deleted or you may not have permission to modify it.";
    }

    // Sync reminders if reminderMinutes was changed
    if (reminderMinutes !== undefined && updatedEvent) {
      try {
        const minutesList = reminderMinutes != null
          ? (Array.isArray(reminderMinutes) ? reminderMinutes : [reminderMinutes])
          : null;
        await reminderService.syncEventReminder(
          userId, updatedEvent.id, updatedEvent.title, updatedEvent.start_time,
          minutesList, updatedEvent.aspect_id || undefined
        );
      } catch (reminderError) {
        console.warn('[UPDATE-EVENT TOOL] Reminder sync failed (non-critical):', reminderError);
      }
    }

    // Build detailed change description
    const changes: string[] = [];
    const eventTitle = title || updatedEvent.title || originalEvent?.title || 'Event';

    if (title && originalEvent?.title !== title) {
      changes.push(`renamed to "${title}"`);
    }
    if (startTimeUTC || endTimeUTC) {
      const dateStr = formatTimeForUser(updatedEvent.start_time, timezone, 'EEEE, MMMM d');
      const startTimeStr = formatTimeForUser(updatedEvent.start_time, timezone, 'h:mm a');
      const endTimeStr = formatTimeForUser(updatedEvent.end_time, timezone, 'h:mm a');
      changes.push(`moved to ${dateStr} from ${startTimeStr} to ${endTimeStr}`);
    }
    if (aspect && originalEvent?.aspect !== aspect) {
      changes.push(`aspect changed to "${aspect}"`);
    }
    if (location && originalEvent?.location !== location) {
      changes.push(`location changed to "${location}"`);
    }
    if (reflection !== undefined && reflection !== null) {
      changes.push('reflection updated');
    }
    if (isMissed !== undefined && isMissed !== null) {
      changes.push(isMissed ? 'marked as missed' : 'marked as attended');
    }
    if (reminderMinutes !== undefined) {
      const mins = reminderMinutes != null
        ? (Array.isArray(reminderMinutes) ? reminderMinutes : [reminderMinutes])
        : [];
      changes.push(mins.length > 0 ? `reminders set to ${mins.join(', ')} min before` : 'reminders removed');
    }

    const changeDescription = changes.length > 0 ? ` - ${changes.join(', ')}` : '';

    return `EVENT: "${eventTitle}" has been updated${changeDescription}`;
  },
  {
    name: "update_event",
    description: "Update an event by ID. Get the #ID from your CALENDAR context or from search_events.",
    schema: z.object({
      eventId: z.string().describe("Event UUID from CALENDAR context (#ID) or search_events results"),
      title: z.string().optional().nullable().describe("New title"),
      startTime: z.string().optional().nullable().describe("New start time ISO (in user's timezone). RULES: 1) Bare numbers without AM/PM default to PM for gym, social, errands, dinner. 2) NEVER pass a time earlier today than the current time — that would move the event into the past."),
      endTime: z.string().optional().nullable().describe("New end time ISO (in user's timezone)"),
      location: z.string().optional().nullable().describe("New location"),
      description: z.string().optional().nullable().describe("New description or notes"),
      aspect: z.string().optional().nullable().describe("New aspect name"),
      reflection: z.string().optional().nullable().describe("Reflection text for past events"),
      isMissed: z.boolean().optional().nullable().describe("Mark event as missed (true/false)"),
      reminderMinutes: z.union([
        z.number().int().min(0).max(10080),
        z.array(z.number().int().min(0).max(10080))
      ]).optional().nullable().describe("Minutes before event for reminder(s). Single number or array. Null to remove."),
    }),
  }
);
