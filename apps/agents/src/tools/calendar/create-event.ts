import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { CategoryService } from "../../services/CategoryService.js";
import { convertToUTC, formatEventTime } from "../../utils/timezoneUtils.js";
import { executeZepOperation } from "../../utils/zep-sync-helper.js";

export const createEventTool = tool(
  async ({ title, startTime, endTime, location, description, category, replaceConflicting = false }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      throw new Error("User ID is required for creating events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for creating events");
    }

    console.log('[CREATE-EVENT TOOL] Starting event creation:', { title, startTime, endTime, category, timezone, replaceConflicting });

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const categoryService = new CategoryService();

    // Validate that category exists - do NOT auto-create
    let validatedCategory = category;
    if (category && category.trim().length > 0) {
      console.log(`[CREATE-EVENT TOOL] Validating category: "${category}"`);

      const existingCategory = await categoryService.getCategoryByName(userId, category.trim());

      if (!existingCategory) {
        // Category doesn't exist - get all available categories and throw error
        const allCategories = await categoryService.getCategories(userId);
        const categoryNames = allCategories.map(c => c.name).join(', ');

        throw new Error(
          `Category "${category}" does not exist. ` +
          `Available categories: [${categoryNames}]. ` +
          `Use an existing category or ask the user to create one first with create_category.`
        );
      }

      console.log(`[CREATE-EVENT TOOL] Category "${category}" validated successfully`);
      validatedCategory = category.trim();
    }

    // Convert local times to UTC for storage
    const startTimeUTC = convertToUTC(startTime, timezone);
    const endTimeUTC = convertToUTC(endTime, timezone);

    console.log(`[CREATE-EVENT TOOL] Converted times - Local: ${startTime} -> UTC: ${startTimeUTC}`);

    // Check for conflicts using UTC times
    try {
      const existingEvents = await supabaseService.getEvents(userId);
      const startDateTime = new Date(startTimeUTC);
      const endDateTime = new Date(endTimeUTC);

      const conflictingEvents = existingEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);

        return (
          (startDateTime >= eventStart && startDateTime < eventEnd) ||
          (endDateTime > eventStart && endDateTime <= eventEnd) ||
          (startDateTime <= eventStart && endDateTime >= eventEnd)
        );
      });

      if (conflictingEvents.length > 0) {
        const conflictingEvent = conflictingEvents[0];

        // If replaceConflicting is true, delete the conflicting event and continue
        if (replaceConflicting) {
          console.log(`[CREATE-EVENT TOOL] Auto-deleting conflicting event: "${conflictingEvent.title}"`);

          const deleteResult = await supabaseService.deleteEvent(userId, conflictingEvent.id);

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
              await zepGraphService.deleteCalendarEvent(conflictingEvent.id);
              return conflictingEvent.id;
            }
          ).catch(err => {
            console.warn('[CREATE-EVENT TOOL] Non-critical: Failed to remove conflicting event from graph:', err);
          });
        } else {
          return `Time conflict detected! You already have "${conflictingEvent.title}" scheduled at ${formatEventTime(conflictingEvent.start_time, timezone)}. Please choose a different time or let me know if you'd like to reschedule the existing event.`;
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
      category: validatedCategory || ''
    });

    console.log('[CREATE-EVENT TOOL] SupabaseService returned:', event ? 'SUCCESS' : 'NULL');

    if (!event) {
      console.error('[CREATE-EVENT TOOL] Event creation failed - supabaseService.createEvent returned null');
      throw new Error("Failed to create event - database operation returned null. Check server logs for details.");
    }

    console.log('[CREATE-EVENT TOOL] Event created successfully:', event.id);

    // Note: Automatic graph sync disabled to prevent Zep graph bloat
    // Individual event creation creates too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement selective sync only for significant events or via periodic aggregation

    // Add context about category in response
    const categoryContext = validatedCategory
      ? ` in category "${validatedCategory}"`
      : '';

    return `Event created successfully: "${title}" at ${formatEventTime(startTimeUTC, timezone)}${categoryContext}`;
  },
  {
    name: "create_event",
    description: "Create a new calendar event. ALWAYS call list_categories first to check existing categories. For specific entities (classes, projects, clients), you MUST create a specific category first using create_category. Generic categories should only be used for truly generic activities.",
    schema: z.object({
      title: z.string().describe("Event title extracted from user input or inferred from context. Make it descriptive and clear."),
      startTime: z.string().describe("Start time in ISO format. Parse relative dates like 'tomorrow', '1pm', 'Friday' into proper timestamps. Use intelligent time defaults: breakfast=morning, lunch=midday, dinner=evening, meetings=business hours"),
      endTime: z.string().describe("End time in ISO format. If not specified, add 1 hour to start time"),
      location: z.string().optional().nullable().describe("Event location. Leave empty if not specified"),
      description: z.string().optional().nullable().describe("Event description. Leave empty if not specified"),
      category: z.string().optional().nullable().describe("Category name for this event. MUST be an existing category - call list_categories first. Will NOT be auto-created. For classes/projects/clients, create a SPECIFIC category first using create_category."),
      replaceConflicting: z.boolean().default(false).nullable().describe("Set to true if user explicitly wants to cancel/reschedule/replace a conflicting event. Examples: 'cancel rehearsal and schedule dinner instead', 'move the meeting and add this', 'replace my 3pm with this'. DO NOT set to true if user just asks about scheduling - only when they explicitly want to override/cancel/replace an existing event."),
    }),
  }
);