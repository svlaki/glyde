import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const createGoalTool = tool(
  async ({ title, description, targetDate, category, goalType, priorityScore, energyRequirement, reviewFrequency }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

      const goal = await supabaseService.createGoal(userId, {
        title,
        description: description || undefined,
        targetDate: targetDate || undefined,
        category: category || 'personal',
        goalType: goalType || 'SMART',
        priorityScore: priorityScore || 5,
        energyRequirement: energyRequirement || undefined,
        reviewFrequency: reviewFrequency || 'weekly',
      });

      if (!goal) {
        return "❌ Failed to create goal";
      }

      // Add to Zep knowledge graph asynchronously
      const addToGraph = async () => {
        try {
          await zepGraphService.addGoal(userId, {
            goalId: goal.id,
            title,
            goal_type: goalType || 'SMART',
            status: 'active',
            progress_percentage: 0,
            deadline: targetDate,
            time_invested_minutes: 0,
          });
          console.log(`✅ [create-goal] Goal added to knowledge graph: ${title}`);
        } catch (error) {
          console.error('⚠️ [create-goal] Failed to add to knowledge graph (non-critical):', error);
        }
      };
      addToGraph(); // Fire and forget

      const targetStr = targetDate ? ` (Target: ${new Date(targetDate).toLocaleDateString()})` : '';
      return `✅ Goal created: "${title}"${targetStr}`;
    } catch (error) {
      console.error('❌ [create-goal] Error:', error);
      return `❌ Error creating goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_goal",
    description: "Create a new goal. Use this when the user wants to set a long-term objective, ambition, or something they want to achieve.",
    schema: z.object({
      title: z.string().describe("Goal title"),
      description: z.string().optional().describe("Goal description"),
      targetDate: z.string().optional().describe("Target completion date (ISO format)"),
      category: z.string().optional().describe("Category name (e.g., 'Career', 'Health', 'Learning')"),
      goalType: z.enum(["SMART", "OKR", "milestone", "habit", "project"]).optional().describe("Type of goal"),
      priorityScore: z.number().min(1).max(10).optional().describe("Priority score (1-10)"),
      energyRequirement: z.enum(["low", "medium", "high"]).optional().describe("Energy requirement"),
      reviewFrequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional().describe("How often to review"),
    }),
  }
);
