import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { AspectService } from "../../services/AspectService.js";
import { convertToUTC, formatEventTime } from "../../utils/timezoneUtils.js";
import { executeZepOperation } from "../../utils/zep-sync-helper.js";
import reminderService from "../../services/ReminderService.js";

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
    const zepGraphService = new ZepGraphService();
    const aspectService = new AspectService();

    // Validate that aspect exists - do NOT auto-create
    let validatedAspect = category;
    if (category && category.trim().length > 0) {
      console.log(`[CREATE-EVENT TOOL] Validating aspect: "${category}"`);

      const existingAspect = await aspectService.getAspectByName(userId, category.trim());

      if (!existingAspect) {
        // Aspect doesn't exist - get all available aspects and throw error
        const allAspects = await aspectService.getAspects(userId);
        const aspectNames = allAspects.map(a => a.name).join(', ');

        throw new Error(
          `Aspect "${category}" does not exist. ` +
          `Available aspects: [${aspectNames}]. ` +
          `Use an existing aspect or ask the user to create one first with create_aspect.`
        );
      }

      console.log(`[CREATE-EVENT TOOL] Aspect "${category}" validated successfully`);
      validatedAspect = category.trim();
    }

    // Convert local times to UTC for storage
    const startTimeUTC = convertToUTC(startTime, timezone);
    const endTimeUTC = convertToUTC(endTime, timezone);

    console.log(`[CREATE-EVENT TOOL] Converted times - Local: ${startTime} -> UTC: ${startTimeUTC}`);

    // Check for conflicts using UTC times — only fetch events in a narrow window around the new event
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

            // Delete from graph with intentional sync tracking
            // Don't block event creation if graph deletion fails - it's non-critical
            executeZepOperation(
              {
                userId,
                entityType: 'event',
                entityId: conflictingEvent.id,
                operation: 'delete',
                maxRetries: 2
              },
              async () => {
                await zepGraphService.deleteCalendarEvent(userId, conflictingEvent.id, conflictingEvent.title);
                return conflictingEvent.id;
              }
            ).catch(err => {
              console.warn('[CREATE-EVENT TOOL] Non-critical: Failed to remove conflicting event from graph:', err);
            });
          }
        } else {
          const isRecurring = conflictingEvent.is_instance ? ' (recurring)' : '';
          return `Time conflict detected! You already have "${conflictingEvent.title}"${isRecurring} scheduled at ${formatEventTime(conflictingEvent.start_time, timezone)}. Please choose a different time or let me know if you'd like to reschedule the existing event.`;
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
      reminder_minutes: reminderMinutes != null ? reminderMinutes : undefined
    }, { source: 'agent', agentType: 'conversation' });

    console.log('[CREATE-EVENT TOOL] SupabaseService returned:', event ? 'SUCCESS' : 'NULL');

    if (!event) {
      console.error('[CREATE-EVENT TOOL] Event creation failed - supabaseService.createEvent returned null');
      throw new Error("Failed to create event - database operation returned null. Check server logs for details.");
    }

    console.log('[CREATE-EVENT TOOL] Event created successfully:', event.id);

    // Create reminder in the unified reminders table if reminder_minutes is set
    if (reminderMinutes != null) {
      try {
        await reminderService.syncEventReminder(
          userId, event.id, title, startTimeUTC, reminderMinutes,
          event.aspect_id || undefined
        );
      } catch (reminderError) {
        console.warn('[CREATE-EVENT TOOL] Reminder sync failed (non-critical):', reminderError);
      }
    }

    // Note: Automatic graph sync disabled to prevent Zep graph bloat
    // Individual event creation creates too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement selective sync only for significant events or via periodic aggregation

    // Add context about aspect in response
    const aspectContext = validatedAspect
      ? ` in aspect "${validatedAspect}"`
      : '';

    return `Event created successfully: "${title}" at ${formatEventTime(startTimeUTC, timezone)}${aspectContext}`;
  },
  {
    name: "create_event",
    description: "Create a calendar event.",
    schema: z.object({
      title: z.string().describe("Event title"),
      startTime: z.string().describe("Start time in ISO format (local timezone, no Z)"),
      endTime: z.string().describe("End time in ISO format. Default: start + 1 hour"),
      location: z.string().optional().nullable().describe("Event location"),
      description: z.string().optional().nullable().describe("Event description"),
      category: z.string().optional().nullable().describe("Aspect name (must exist)"),
      visibility: z.enum(["private", "friends", "public"]).optional().nullable().describe("private|friends|public. Default: private"),
      replaceConflicting: z.boolean().default(false).nullable().describe("True to replace conflicting event"),
      projectId: z.string().optional().nullable().describe("Project UUID to link to"),
      reminderMinutes: z.number().int().min(0).max(10080).optional().nullable().describe("Minutes before event for reminder (0-10080)"),
    }),
  }
);