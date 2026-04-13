import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { AspectService } from "../../services/AspectService.js";
import { convertToUTC, formatEventTime } from "../../utils/timezoneUtils.js";
import reminderService from "../../services/ReminderService.js";
import { DEFAULT_REMINDER_MINUTES } from "../../types/database.js";

export const createEventTool = tool(
  async ({ title, startTime, endTime, location, description, category, visibility, replaceConflicting = false, projectId, reminderMinutes }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      throw new Error("User ID is required for creating events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for creating events");
    }

    console.log('[CREATE-EVENT TOOL] Starting event creation:', { title, startTime, endTime, aspect: category, timezone, replaceConflicting });

    // Initialize services
    const supabaseService = new SupabaseService();
    const aspectService = new AspectService();

    // Validate aspect — auto-create if it doesn't exist (handles parallel tool calls)
    let validatedAspect = category;
    if (category && category.trim().length > 0) {
      const trimmedAspect = category.trim();
      console.log(`[CREATE-EVENT TOOL] Validating aspect: "${trimmedAspect}"`);

      let existingAspect = await aspectService.getAspectByName(userId, trimmedAspect);

      if (!existingAspect) {
        console.log(`[CREATE-EVENT TOOL] Aspect "${trimmedAspect}" not found, auto-creating`);
        try {
          existingAspect = await aspectService.createAspect(userId, { name: trimmedAspect, color: '#6B7280' });
          console.log(`[CREATE-EVENT TOOL] Auto-created aspect "${trimmedAspect}"`);
        } catch (createErr: any) {
          // May have been created by parallel create_aspect call — retry lookup
          existingAspect = await aspectService.getAspectByName(userId, trimmedAspect);
          if (!existingAspect) {
            throw new Error(`Failed to create or find aspect "${trimmedAspect}": ${createErr.message}`);
          }
        }
      }

      console.log(`[CREATE-EVENT TOOL] Aspect "${trimmedAspect}" validated successfully`);
      validatedAspect = trimmedAspect;
    }

    // Convert local times to UTC for storage
    const startTimeUTC = convertToUTC(startTime, timezone);
    const endTimeUTC = convertToUTC(endTime, timezone);

    console.log(`[CREATE-EVENT TOOL] Converted times - Local: ${startTime} -> UTC: ${startTimeUTC}`);

    // Check for conflicts using UTC times — only fetch events in a narrow window around the new event
    let overlapNote = '';
    try {
      const startDateTime = new Date(startTimeUTC);
      const endDateTime = new Date(endTimeUTC);

      // Only fetch events within +/- 1 day of the new event to avoid loading the entire calendar
      const windowStart = new Date(startDateTime.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const existingEvents = await supabaseService.getEvents(userId, windowStart, windowEnd);

      const conflictingEvents = existingEvents.filter((event: any) => {
        // Skip all-day events — they don't represent actual time blocks
        if (event.is_all_day) return false;

        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);

        return (
          (startDateTime >= eventStart && startDateTime < eventEnd) ||
          (endDateTime > eventStart && endDateTime <= eventEnd) ||
          (startDateTime <= eventStart && endDateTime >= eventEnd)
        );
      });

      if (conflictingEvents.length > 0) {
        const conflictingEvent = conflictingEvents[0] as any;
        console.log(`[CREATE-EVENT TOOL] Conflict detected with "${conflictingEvent.title}" (${conflictingEvent.start_time} - ${conflictingEvent.end_time}), replaceConflicting=${replaceConflicting}`);

        // If replaceConflicting is true, delete the conflicting event and continue
        if (replaceConflicting) {
          console.log(`[CREATE-EVENT TOOL] Auto-deleting conflicting event: "${conflictingEvent.title}"`);

          // Check if the conflicting event is a recurring instance
          if (conflictingEvent.is_instance && conflictingEvent.parent_event_id) {
            // Delete just this instance of the recurring event
            console.log(`[CREATE-EVENT TOOL] Conflicting event is a recurring instance, deleting only this occurrence`);

            const instanceDeleted = await supabaseService.deleteRecurringEventInstance(
              userId,
              conflictingEvent.parent_event_id,
              conflictingEvent.instance_date || conflictingEvent.start_time
            );

            if (!instanceDeleted) {
              throw new Error(`Failed to delete conflicting recurring instance "${conflictingEvent.title}"`);
            }

            console.log(`[CREATE-EVENT TOOL] Recurring instance "${conflictingEvent.title}" on ${conflictingEvent.instance_date} deleted, proceeding with creation`);
          } else {
            // Regular event deletion
            const deleteResult = await supabaseService.deleteEvent(userId, conflictingEvent.id, { source: 'agent', agentType: 'conversation' });

            if (!deleteResult.success) {
              throw new Error(`Failed to delete conflicting event "${conflictingEvent.title}": ${deleteResult.error}`);
            }

            console.log(`[CREATE-EVENT TOOL] Conflicting event "${conflictingEvent.title}" deleted, proceeding with creation`);
          }
        } else {
          // Don't block creation — overlapping events are normal (e.g. focus blocks over meetings).
          // Just log the overlap so the agent can mention it in the response.
          const isRecurring = conflictingEvent.is_instance ? ' (recurring)' : '';
          console.log(`[CREATE-EVENT TOOL] Overlap with "${conflictingEvent.title}"${isRecurring} — proceeding with creation anyway`);
          overlapNote = ` (Note: overlaps with "${conflictingEvent.title}" at the same time)`;
        }
      }
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      // Continue with event creation if conflict check fails
    }

    // Create the event with UTC times
    const event = await supabaseService.createEvent(userId, {
      title,
      start_time: startTimeUTC,
      end_time: endTimeUTC,
      location: location || "",
      description: description || "",
      aspect: validatedAspect || '',
      visibility: visibility || 'private',
      project_id: projectId || undefined,
      reminder_minutes: reminderMinutes != null
        ? (Array.isArray(reminderMinutes) ? reminderMinutes : [reminderMinutes])
        : undefined
    }, { source: 'agent', agentType: 'conversation' });

    console.log('[CREATE-EVENT TOOL] SupabaseService returned:', event ? 'SUCCESS' : 'NULL');

    if (!event) {
      console.error('[CREATE-EVENT TOOL] Event creation failed - supabaseService.createEvent returned null');
      throw new Error("Failed to create event - database operation returned null. Check server logs for details.");
    }

    console.log('[CREATE-EVENT TOOL] Event created successfully:', event.id);

    // Create reminders in the unified reminders table — use defaults if not specified
    try {
      const minutesList = reminderMinutes != null
        ? (Array.isArray(reminderMinutes) ? reminderMinutes : [reminderMinutes])
        : DEFAULT_REMINDER_MINUTES;
      await reminderService.syncEventReminder(
        userId, event.id, title, startTimeUTC, minutesList,
        event.aspect_id || undefined
      );
    } catch (reminderError) {
      console.warn('[CREATE-EVENT TOOL] Reminder sync failed (non-critical):', reminderError);
    }

    // Add context about aspect in response
    const aspectContext = validatedAspect
      ? ` in aspect "${validatedAspect}"`
      : '';

    return `Event created successfully: "${title}" at ${formatEventTime(startTimeUTC, timezone)}${aspectContext}${overlapNote}`;
  },
  {
    name: "create_event",
    description: "Create a calendar event.",
    schema: z.object({
      title: z.string().describe("Event title"),
      startTime: z.string().describe("Start time in ISO format (local timezone, no Z). RULES: 1) 'after [event]' means start when that event ENDS — look up its end_time. 2) Bare numbers without AM/PM default to PM for gym, social, errands, dinner. 3) NEVER pass a time earlier today than the current time."),
      endTime: z.string().describe("End time in ISO format. Default: start + 1 hour"),
      location: z.string().optional().nullable().describe("Event location"),
      description: z.string().optional().nullable().describe("Event description"),
      category: z.string().optional().nullable().describe("Aspect name (must exist). Match activity to obvious aspect: gym/exercise/run/yoga → Health, hangout/social/dinner → Personal or Social, study/class → Education."),
      visibility: z.enum(["private", "friends", "public"]).optional().nullable().describe("private|friends|public. Default: private"),
      replaceConflicting: z.boolean().default(false).nullable().describe("True to replace conflicting event"),
      projectId: z.string().optional().nullable().describe("Project UUID to link to"),
      reminderMinutes: z.union([
        z.number().int().min(0).max(10080),
        z.array(z.number().int().min(0).max(10080))
      ]).optional().nullable().describe("Minutes before event for reminder(s). Single number or array of numbers (0-10080)."),
    }),
  }
);