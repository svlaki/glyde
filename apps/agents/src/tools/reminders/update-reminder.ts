import { tool } from "@langchain/core/tools";
import { z } from "zod";
import reminderService from "../../services/ReminderService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const updateReminderTool = tool(
  async ({ reminderId, message, triggerAt, aspectId }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const updates: Record<string, any> = {};
      if (message) updates.message = message;
      if (triggerAt) {
        const triggerAtUTC = timezone ? convertToUTC(triggerAt, timezone) : new Date(triggerAt).toISOString();
        const triggerDate = new Date(triggerAtUTC);
        if (isNaN(triggerDate.getTime())) {
          return "Error: Invalid trigger time.";
        }
        updates.trigger_at = triggerAtUTC;
      }
      if (aspectId !== undefined) updates.aspect_id = aspectId;

      const updated = await reminderService.updateReminder(userId, reminderId, updates);

      if (!updated) {
        return "Reminder not found or failed to update.";
      }

      return `Reminder updated: "${updated.message}"`;
    } catch (error) {
      console.error('[update-reminder] Error:', error);
      return `Error updating reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_reminder",
    description: "Update a reminder.",
    schema: z.object({
      reminderId: z.string().uuid().describe("Reminder UUID"),
      message: z.string().optional().nullable().describe("New message"),
      triggerAt: z.string().optional().nullable().describe("New trigger time in ISO format (local timezone, no Z suffix)"),
      aspectId: z.string().uuid().optional().nullable().describe("New aspect UUID"),
    }),
  }
);
