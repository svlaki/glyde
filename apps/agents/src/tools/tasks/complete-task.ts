import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const completeTaskTool = tool(
  async ({ taskId, notes, actualDuration }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

      const task = await supabaseService.completeTask(
        userId,
        taskId,
        notes || undefined,
        actualDuration || undefined
      );

      if (!task) {
        return "❌ Failed to complete task";
      }

      // Update task completion in Zep knowledge graph asynchronously
      const updateGraph = async () => {
        try {
          await zepGraphService.addTask(userId, {
            taskId: task.id,
            title: task.title,
            priority: task.priority || 'medium',
            category: task.category || 'personal',
            actual_duration: actualDuration,
            satisfaction_rating: 4, // Default good rating, can be enhanced later
            energy_required: task.energy_required || 'medium',
          });
          console.log(`✅ [complete-task] Task completion added to knowledge graph: ${task.title}`);
        } catch (error) {
          console.error('⚠️ [complete-task] Failed to update knowledge graph (non-critical):', error);
        }
      };
      updateGraph(); // Fire and forget

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
