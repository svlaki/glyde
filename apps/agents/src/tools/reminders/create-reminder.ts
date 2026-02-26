import { tool } from "@langchain/core/tools";
import { z } from "zod";
import reminderService from "../../services/ReminderService.js";

export const createReminderTool = tool(
  async ({ message, triggerAt, aspectId, metadata }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const triggerDate = new Date(triggerAt);
      if (isNaN(triggerDate.getTime())) {
        return "Error: Invalid trigger time. Use ISO 8601 format (e.g., 2026-02-26T09:00:00).";
      }

      const reminder = await reminderService.createReminder(userId, {
        message,
        trigger_at: triggerDate.toISOString(),
        aspect_id: aspectId || undefined,
        created_by: 'conversation',
        metadata: metadata || undefined,
      });

      if (!reminder) {
        return "Failed to create reminder";
      }

      const timezone = config?.configurable?.timezone || 'UTC';
      const timeStr = triggerDate.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone,
      });

      return `Reminder set: "${message}" at ${timeStr} (ID: ${reminder.id})`;
    } catch (error) {
      console.error('[create-reminder] Error:', error);
      return `Error creating reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_reminder",
    description: "Create a reminder that will notify the user at a specific time. The reminder appears as an interaction card when it fires. Use for: 'remind me to...', 'don't let me forget...', follow-up nudges, time-sensitive prompts.",
    schema: z.object({
      message: z.string().describe("What to remind the user about"),
      triggerAt: z.string().describe("When to fire the reminder (ISO 8601 datetime in user's local timezone, no Z suffix)"),
      aspectId: z.string().uuid().optional().nullable().describe("Aspect UUID to categorize the reminder"),
      metadata: z.record(z.any()).optional().nullable().describe("Optional context: related_event_id, related_task_id, etc."),
    }),
  }
);
