import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const listGoalsTool = tool(
  async ({ status, category, goalType }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const filters: any = {};

      if (status) filters.status = status;
      if (category) filters.category = category;
      if (goalType) filters.goalType = goalType;

      const goals = await supabaseService.getGoals(userId, filters);

      if (!goals || goals.length === 0) {
        return "No goals found matching the criteria.";
      }

      const goalList = goals.map((goal, index) => {
        const targetStr = goal.target_date ? ` (Target: ${new Date(goal.target_date).toLocaleDateString()})` : '';
        const progressStr = goal.progress ? ` - ${goal.progress}% complete` : '';
        const statusStr = goal.status ? ` [${goal.status.toUpperCase()}]` : '';
        return `${index + 1}. ${goal.title}${statusStr}${progressStr}${targetStr}`;
      }).join('\n');

      return `Found ${goals.length} goal(s):\n${goalList}`;
    } catch (error) {
      console.error('❌ [list-goals] Error:', error);
      return `❌ Error listing goals: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_goals",
    description: "List goals with optional filters. Use this to show the user their goals, check progress, or find specific objectives.",
    schema: z.object({
      status: z.enum(["active", "completed", "paused", "abandoned"]).optional().describe("Filter by status"),
      category: z.string().optional().describe("Filter by category"),
      goalType: z.enum(["SMART", "OKR", "milestone", "habit", "project"]).optional().describe("Filter by goal type"),
    }),
  }
);
