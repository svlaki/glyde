import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const completeTaskTool = tool(
  async ({ taskId, notes, actualDuration }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const task = await supabaseService.completeTask(
        userId,
        taskId,
        notes || undefined,
        actualDuration || undefined
      );

      if (!task) {
        return "❌ Failed to complete task";
      }

      return `✅ Task completed: "${task.title}"`;
    } catch (error) {
      console.error('❌ [complete-task] Error:', error);
      return `❌ Error completing task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "complete_task",
    description: "Mark a task as completed. Use this when the user finishes a task or says they're done with something.",
    schema: z.object({
      taskId: z.string().describe("Task ID to complete"),
      notes: z.string().nullable().optional().describe("Completion notes or comments"),
      actualDuration: z.number().nullable().optional().describe("Actual time spent in minutes"),
    }),
  }
);
