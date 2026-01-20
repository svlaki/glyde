import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { CategoryService } from "../../services/CategoryService.js";
import { convertToUTC, formatEventTime } from "../../utils/timezoneUtils.js";
import { parseNaturalLanguageRecurrence, formatRRuleForDisplay, validateRRule } from "../../utils/rrule.js";
import { executeZepOperation } from "../../utils/zep-sync-helper.js";

export const createRecurringEventTool = tool(
  async ({ title, startTime, endTime, recurrence, rrule, category, description, location, endDate }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      throw new Error("User ID is required for creating recurring events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for creating recurring events");
    }

    console.log('[CREATE-RECURRING-EVENT TOOL] Starting recurring event creation:', {
      title,
      startTime,
      endTime,
      recurrence,
      rrule,
      category,
      timezone
    });

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const categoryService = new CategoryService();

    // Parse recurrence pattern
    let finalRRule: string;
    let parsedResult = null;

    if (rrule) {
      // Direct RRULE provided
      if (!validateRRule(rrule)) {
        throw new Error(`Invalid RRULE format: ${rrule}`);
      }
      finalRRule = rrule;
      console.log('[CREATE-RECURRING-EVENT TOOL] Using provided RRULE:', rrule);
    } else if (recurrence) {
      // Parse natural language recurrence
      console.log('[CREATE-RECURRING-EVENT TOOL] Parsing natural language recurrence:', recurrence);

      const startDate = new Date(startTime);
      parsedResult = parseNaturalLanguageRecurrence(recurrence, startDate);

      if (!parsedResult) {
        throw new Error(
          `Could not parse recurrence pattern: "${recurrence}". Try patterns like "every Monday at 10am", "daily for 30 days", "weekly on Tuesday and Thursday"`
        );
      }

      finalRRule = parsedResult.rrule;
      console.log('[CREATE-RECURRING-EVENT TOOL] Parsed RRULE:', finalRRule);
    } else {
      throw new Error("Either 'recurrence' (natural language) or 'rrule' (RFC 5545 format) is required");
    }

    // Validate that category exists - do NOT auto-create
    let validatedCategory = category;
    if (category && category.trim().length > 0) {
      console.log(`[CREATE-RECURRING-EVENT TOOL] Validating category: "${category}"`);

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

      console.log(`[CREATE-RECURRING-EVENT TOOL] Category "${category}" validated successfully`);
      validatedCategory = category.trim();
    }

    // Convert local times to UTC
    const startTimeUTC = convertToUTC(startTime, timezone);
    const endTimeUTC = convertToUTC(endTime, timezone);

    console.log(`[CREATE-RECURRING-EVENT TOOL] Event times - Start UTC: ${startTimeUTC}, End UTC: ${endTimeUTC}`);

    // Create the recurring event
    const recurringEvent = await supabaseService.createRecurringEvent(userId, {
      title,
      start_time: startTimeUTC,
      end_time: endTimeUTC,
      location: location || "",
      description: description || "",
      category: validatedCategory || '',
      recurrence_rule: finalRRule,
      recurrence_end: endDate || undefined
    });

    console.log('[CREATE-RECURRING-EVENT TOOL] SupabaseService returned:', recurringEvent ? 'SUCCESS' : 'NULL');

    if (!recurringEvent) {
      throw new Error("Failed to create recurring event - database operation returned null");
    }

    console.log('[CREATE-RECURRING-EVENT TOOL] Recurring event created successfully:', recurringEvent.id);

    // Sync to Zep (fire and forget, non-blocking)
    executeZepOperation(
      {
        userId,
        entityType: 'event',
        entityId: recurringEvent.id,
        operation: 'create',
        maxRetries: 2
      },
      async () => {
        await zepGraphService.addCalendarEvent(userId, recurringEvent);
        return recurringEvent.id;
      }
    ).catch(err => {
      console.warn('[CREATE-RECURRING-EVENT TOOL] Non-critical: Failed to sync to Zep:', err);
    });

    const categoryContext = validatedCategory ? ` in category "${validatedCategory}"` : '';
    const recurrenceDescription = formatRRuleForDisplay(finalRRule);

    return `✅ Recurring event created successfully!\n\n**${title}**${categoryContext}\n**Pattern:** ${recurrenceDescription}\n**Starting:** ${formatEventTime(startTimeUTC, timezone)}${
      endDate ? `\n**Until:** ${endDate}` : ''
    }\n\nI'll automatically create instances for each occurrence on your calendar.`;
  },
  {
    name: "create_recurring_event",
    description: "Create a recurring calendar event with a recurrence pattern. Supports natural language patterns like 'every Monday and Friday' or direct RFC 5545 RRULE format.",
    schema: z.object({
      title: z.string().describe("Event title (e.g., 'Team standup', 'Weekly review', 'Gym session')"),
      startTime: z.string().describe("Start time for the first occurrence in ISO format. Examples: '2024-01-15T10:00:00', 'Monday at 2pm', '10:30am'"),
      endTime: z.string().describe("End time for the first occurrence in ISO format. This determines the duration of each recurring instance."),
      recurrence: z.string().optional().describe("Natural language recurrence pattern. Examples: 'every Monday at 10am', 'daily for 30 days', 'every Tuesday and Thursday at 2pm', 'weekly for 12 weeks', 'monthly on the 15th'"),
      rrule: z.string().optional().describe("RFC 5545 RRULE format string (e.g., 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12'). Use if you have a specific RRULE. Either 'recurrence' or 'rrule' is required."),
      category: z.string().optional().describe("Category for this event. MUST be an existing category - call list_categories first. Will NOT be auto-created."),
      description: z.string().optional().describe("Description for the recurring event"),
      location: z.string().optional().describe("Location for the recurring event"),
      endDate: z.string().optional().describe("End date for the recurrence in ISO format (e.g., '2024-03-15'). Optional - omit for indefinite recurrence."),
    }),
  }
);
