import { tool } from "@langchain/core/tools";
import { z } from "zod";
import reminderService from "../../services/ReminderService.js";

export const updateReminderTool = tool(
  async ({ reminderId, message, triggerAt, aspectId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const updates: Record<string, any> = {};
      if (message) updates.message = message;
      if (triggerAt) {
        const triggerDate = new Date(triggerAt);
        if (isNaN(triggerDate.getTime())) {
          return "Error: Invalid trigger time.";
        }
        updates.trigger_at = triggerDate.toISOString();
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
    description: "Update an existing reminder's message, time, or aspect.",
    schema: z.object({
      reminderId: z.string().uuid().describe("ID of the reminder to update"),
      message: z.string().optional().nullable().describe("Updated reminder message"),
      triggerAt: z.string().optional().nullable().describe("Updated trigger time (ISO 8601)"),
      aspectId: z.string().uuid().optional().nullable().describe("Updated aspect UUID"),
    }),
  }
);
