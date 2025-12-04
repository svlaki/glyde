import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const listGoalsTool = tool(
  async ({ status, category, goalType }, config) => {
    const userId = config?.configurable?.userId;
    console.log('🎯 [LIST-GOALS TOOL] Called with:', {
      userId,
      status,
      category,
      goalType,
      hasConfig: !!config,
      configKeys: config ? Object.keys(config) : []
    });

    if (!userId) {
      console.error('❌ [LIST-GOALS TOOL] Missing userId in config');
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const filters: any = {};

      if (status) filters.status = status;
      if (category) filters.category = category;
      if (goalType) filters.goalType = goalType;

      console.log('🔍 [LIST-GOALS TOOL] Fetching goals with filters:', filters);
      const goals = await supabaseService.getGoals(userId, filters);
      console.log('📊 [LIST-GOALS TOOL] Retrieved goals:', {
        count: goals?.length || 0,
        hasGoals: !!goals && goals.length > 0
      });

      if (!goals || goals.length === 0) {
        console.log('⚠️ [LIST-GOALS TOOL] No goals found');
        return "No goals found matching the criteria.";
      }

      const goalList = goals.map((goal, index) => {
        const targetStr = goal.target_date ? ` (Target: ${new Date(goal.target_date).toLocaleDateString()})` : '';
        const progressStr = goal.progress ? ` - ${goal.progress}% complete` : '';
        const statusStr = goal.status ? ` [${goal.status.toUpperCase()}]` : '';
        return `${index + 1}. ${goal.title}${statusStr}${progressStr}${targetStr}\n   ID: ${goal.id}`;
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
      status: z.enum(["active", "completed", "paused", "abandoned"]).optional().nullable().describe("Filter by status"),
      category: z.string().optional().nullable().describe("Filter by category"),
      goalType: z.enum(["SMART", "OKR", "milestone", "habit", "project"]).optional().nullable().describe("Filter by goal type"),
    }),
  }
);
