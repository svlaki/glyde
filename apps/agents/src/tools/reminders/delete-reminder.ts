import { tool } from "@langchain/core/tools";
import { z } from "zod";
import reminderService from "../../services/ReminderService.js";

export const deleteReminderTool = tool(
  async ({ reminderId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const result = await reminderService.deleteReminder(userId, reminderId);

      if (!result.success) {
        return `Failed to dismiss reminder: ${result.error || 'Not found'}`;
      }

      return "Reminder dismissed.";
    } catch (error) {
      console.error('[delete-reminder] Error:', error);
      return `Error dismissing reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_reminder",
    description: "Dismiss/cancel a reminder.",
    schema: z.object({
      reminderId: z.string().uuid().describe("Reminder UUID"),
    }),
  }
);
