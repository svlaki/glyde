import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const updateGoalTool = tool(
  async ({ goalId, title, description, targetDate, status, progress, category, priorityScore }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

      const updates: any = {};

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (targetDate !== undefined) updates.targetDate = targetDate;
      if (status !== undefined) updates.status = status;
      if (progress !== undefined) updates.progress = progress;
      if (category !== undefined) updates.category = category;
      if (priorityScore !== undefined) updates.priorityScore = priorityScore;

      const goal = await supabaseService.updateGoal(userId, goalId, updates);

      if (!goal) {
        return "❌ Failed to update goal";
      }

      // Update in Zep knowledge graph asynchronously
      const updateGraph = async () => {
        try {
          await zepGraphService.addGoal(userId, {
            goalId: goal.id,
            title: goal.title,
            goal_type: goal.goal_type || 'SMART',
            status: goal.status || 'active',
            progress_percentage: progress !== undefined ? progress : (goal.progress || 0),
            deadline: goal.target_date,
            time_invested_minutes: 0, // Could be enhanced to track actual time
          });
          console.log(`✅ [update-goal] Goal update added to knowledge graph: ${goal.title}`);
        } catch (error) {
          console.error('⚠️ [update-goal] Failed to update knowledge graph (non-critical):', error);
        }
      };
      updateGraph(); // Fire and forget

      return `✅ Goal updated: "${goal.title}"${progress !== undefined ? ` (Progress: ${progress}%)` : ''}`;
    } catch (error) {
      console.error('❌ [update-goal] Error:', error);
      return `❌ Error updating goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_goal",
    description: "Update an existing goal. Use this to modify goal details, update progress, change status, or reschedule target dates.",
    schema: z.object({
      goalId: z.string().describe("Goal ID to update"),
      title: z.string().optional().describe("New goal title"),
      description: z.string().optional().describe("New goal description"),
      targetDate: z.string().optional().describe("New target date (ISO format)"),
      status: z.enum(["active", "completed", "paused", "abandoned"]).optional().describe("New status"),
      progress: z.number().min(0).max(100).optional().describe("Progress percentage (0-100)"),
      category: z.string().optional().describe("New category name"),
      priorityScore: z.number().min(1).max(10).optional().describe("New priority score (1-10)"),
    }),
  }
);
