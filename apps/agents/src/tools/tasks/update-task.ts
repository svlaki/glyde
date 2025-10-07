import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const updateTaskTool = tool(
  async ({ taskId, title, description, dueDate, priority, status, category, energyRequired, estimatedDuration }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const updates: any = {};

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (priority !== undefined) updates.priority = priority;
      if (status !== undefined) updates.status = status;
      if (category !== undefined) updates.category = category;
      if (energyRequired !== undefined) updates.energyRequired = energyRequired;
      if (estimatedDuration !== undefined) updates.estimatedDuration = estimatedDuration;

      const task = await supabaseService.updateTask(userId, taskId, updates);

      if (!task) {
        return "❌ Failed to update task";
      }

      return `✅ Task updated: "${task.title}"`;
    } catch (error) {
      console.error('❌ [update-task] Error:', error);
      return `❌ Error updating task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_task",
    description: "Update an existing task. Use this to modify task details, change priority, reschedule, or update status.",
    schema: z.object({
      taskId: z.string().describe("Task ID to update"),
      title: z.string().nullable().optional().describe("New task title"),
      description: z.string().nullable().optional().describe("New task description"),
      dueDate: z.string().nullable().optional().describe("New due date (ISO format)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional().describe("New priority level"),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).nullable().optional().describe("New status"),
      category: z.string().nullable().optional().describe("New category name"),
      energyRequired: z.enum(["low", "medium", "high"]).nullable().optional().describe("Energy level required"),
      estimatedDuration: z.number().nullable().optional().describe("Estimated duration in minutes"),
    }),
  }
);
