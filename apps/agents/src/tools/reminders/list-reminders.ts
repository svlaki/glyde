import { tool } from "@langchain/core/tools";
import { z } from "zod";
import reminderService from "../../services/ReminderService.js";

export const listRemindersTool = tool(
  async ({ status, aspectId, includeHistory }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const reminders = await reminderService.getReminders(userId, {
        status: status || undefined,
        aspectId: aspectId || undefined,
        includeHistory: includeHistory || false,
      });

      if (reminders.length === 0) {
        return "No reminders found.";
      }

      const timezone = config?.configurable?.timezone || 'UTC';
      const lines = reminders.map(r => {
        const time = new Date(r.trigger_at).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: timezone,
        });
        return `- "${r.message}" at ${time} [${r.status}] (ID: ${r.id})`;
      });

      return `Reminders (${reminders.length}):\n${lines.join('\n')}`;
    } catch (error) {
      console.error('[list-reminders] Error:', error);
      return `Error listing reminders: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_reminders",
    description: "List the user's reminders. By default shows only pending/snoozed. Set includeHistory=true to see delivered/dismissed ones too.",
    schema: z.object({
      status: z.enum(["pending", "delivered", "snoozed", "dismissed"]).optional().nullable().describe("Filter by status"),
      aspectId: z.string().uuid().optional().nullable().describe("Filter by aspect"),
      includeHistory: z.boolean().optional().nullable().describe("Include delivered/dismissed reminders. Default: false."),
    }),
  }
);
