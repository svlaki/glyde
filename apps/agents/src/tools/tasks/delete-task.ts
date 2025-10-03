import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const deleteTaskTool = tool(
  async ({ taskId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const result = await supabaseService.deleteTask(userId, taskId);

      if (!result.success) {
        return `❌ Failed to delete task: ${result.error}`;
      }

      return `✅ Task deleted successfully`;
    } catch (error) {
      console.error('❌ [delete-task] Error:', error);
      return `❌ Error deleting task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_task",
    description: "Delete a task. Use this when the user wants to remove a task permanently.",
    schema: z.object({
      taskId: z.string().describe("Task ID to delete"),
    }),
  }
);
