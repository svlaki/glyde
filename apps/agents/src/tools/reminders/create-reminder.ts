import { tool } from "@langchain/core/tools";
import { z } from "zod";
import reminderService from "../../services/ReminderService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const createReminderTool = tool(
  async ({ message, triggerAt, aspectId, metadata }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      // Convert local time to UTC for storage
      const triggerAtUTC = timezone ? convertToUTC(triggerAt, timezone) : new Date(triggerAt).toISOString();
      const triggerDate = new Date(triggerAtUTC);
      if (isNaN(triggerDate.getTime())) {
        return "Error: Invalid trigger time. Use ISO 8601 format (e.g., 2026-02-26T09:00:00).";
      }

      const reminder = await reminderService.createReminder(userId, {
        message,
        trigger_at: triggerAtUTC,
        aspect_id: aspectId || undefined,
        created_by: 'conversation',
        metadata: metadata || undefined,
      });

      if (!reminder) {
        return "Failed to create reminder";
      }

      const displayTimezone = timezone || 'UTC';
      const timeStr = triggerDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: displayTimezone,
      });

      return `Reminder set: "${message}" at ${timeStr} (ID: ${reminder.id})`;
    } catch (error) {
      console.error('[create-reminder] Error:', error);
      return `Error creating reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_reminder",
    description: "Create a reminder at a specific time.",
    schema: z.object({
      message: z.string().describe("Reminder message"),
      triggerAt: z.string().describe("Trigger time in ISO 8601 format (local timezone, no Z suffix)"),
      aspectId: z.string().uuid().optional().nullable().describe("Aspect UUID"),
      metadata: z.record(z.any()).optional().nullable().describe("Context (JSON)"),
    }),
  }
);
