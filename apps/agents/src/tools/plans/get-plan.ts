import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const getPlanTool = tool(
  async (_input, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const plan = await supabaseService.getPlan(userId);

      if (!plan) {
        return "No life plan found. The user hasn't created a plan yet.";
      }

      return JSON.stringify({
        id: plan.id,
        title: plan.title,
        content: plan.content || "(No content yet)",
        status: plan.status,
        horizon_start: plan.horizon_start,
        horizon_end: plan.horizon_end,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      });
    } catch (error) {
      console.error('[get-plan] Error:', error);
      return `Error fetching plan: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "get_plan",
    description: "Get the user's life plan.",
    schema: z.object({}),
  }
);
