import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { AspectService } from "../../services/AspectService.js";
import { convertToUTC, formatEventTime } from "../../utils/timezoneUtils.js";
import { parseNaturalLanguageRecurrence, formatRRuleForDisplay, validateRRule } from "../../utils/rrule.js";
import { executeZepOperation } from "../../utils/zep-sync-helper.js";

export const createRecurringEventTool = tool(
  async ({ title, startTime, endTime, recurrence, rrule, aspect, description, location, endDate }, config) => {
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
      aspect,
      timezone
    });

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const aspectService = new AspectService();

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

    // Validate aspect — auto-create if it doesn't exist (handles parallel tool calls)
    let validatedAspect = aspect;
    if (aspect && aspect.trim().length > 0) {
      const trimmedAspect = aspect.trim();
      console.log(`[CREATE-RECURRING-EVENT TOOL] Validating aspect: "${trimmedAspect}"`);

      let existingAspect = await aspectService.getAspectByName(userId, trimmedAspect);

      if (!existingAspect) {
        // Aspect doesn't exist yet — auto-create it so parallel tool calls work
        console.log(`[CREATE-RECURRING-EVENT TOOL] Aspect "${trimmedAspect}" not found, auto-creating`);
        try {
          existingAspect = await aspectService.createAspect(userId, { name: trimmedAspect, color: '#6B7280' });
          console.log(`[CREATE-RECURRING-EVENT TOOL] Auto-created aspect "${trimmedAspect}"`);
        } catch (createErr: any) {
          // May have been created by parallel create_aspect call — retry lookup
          existingAspect = await aspectService.getAspectByName(userId, trimmedAspect);
          if (!existingAspect) {
            throw new Error(`Failed to create or find aspect "${trimmedAspect}": ${createErr.message}`);
          }
        }
      }

      console.log(`[CREATE-RECURRING-EVENT TOOL] Aspect "${trimmedAspect}" validated successfully`);
      validatedAspect = trimmedAspect;
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
      aspect: validatedAspect || '',
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

    const aspectContext = validatedAspect ? ` in aspect "${validatedAspect}"` : '';
    const recurrenceDescription = formatRRuleForDisplay(finalRRule);

    return `Recurring event created successfully!\n\n**${title}**${aspectContext}\n**Pattern:** ${recurrenceDescription}\n**Starting:** ${formatEventTime(startTimeUTC, timezone)}${
      endDate ? `\n**Until:** ${endDate}` : ''
    }\n\nI'll automatically create instances for each occurrence on your calendar.`;
  },
  {
    name: "create_recurring_event",
    description: "Create a recurring calendar event.",
    schema: z.object({
      title: z.string().describe("Event title"),
      startTime: z.string().describe("First occurrence start time ISO"),
      endTime: z.string().describe("First occurrence end time ISO"),
      recurrence: z.string().optional().describe("Natural language pattern (e.g., 'every Monday')"),
      rrule: z.string().optional().describe("RFC 5545 RRULE string"),
      aspect: z.string().optional().describe("Aspect name (must exist)"),
      description: z.string().optional().describe("Description"),
      location: z.string().optional().describe("Location"),
      endDate: z.string().optional().describe("Recurrence end date ISO"),
    }),
  }
);
