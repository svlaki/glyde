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
        actualDuration || undefined,
        { source: 'agent', agentType: 'conversation' }
      );

      if (!task) {
        return "❌ Failed to complete task";
      }

      // NOTE: We don't sync completed tasks to Zep because:
      // 1. Task completion is already tracked in Supabase (status='completed')
      // 2. Zep's temporal system automatically handles task invalidation when new data arrives
      // 3. Adding "completed" versions creates duplicate/orphaned nodes in the graph
      // 4. Completion metadata (duration, notes, rating) is accessed from task status in Supabase
      // Only task DELETION should trigger graph cleanup (via deleteTask tool)

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
      notes: z.string().optional().nullable().describe("Completion notes or comments"),
      actualDuration: z.number().optional().nullable().describe("Actual time spent in minutes"),
    }),
  }
);
