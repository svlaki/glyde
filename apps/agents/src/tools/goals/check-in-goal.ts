import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const checkInGoalTool = tool(
  async ({ goalId, progressUpdate, moodRating, confidenceLevel, obstaclesEncountered, winsAndProgress, nextSteps, reflectionNotes }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const checkIn = await supabaseService.addGoalCheckIn(userId, goalId, {
        progressUpdate: progressUpdate || undefined,
        moodRating: moodRating || undefined,
        confidenceLevel: confidenceLevel || undefined,
        obstaclesEncountered: obstaclesEncountered || undefined,
        winsAndProgress: winsAndProgress || undefined,
        nextSteps: nextSteps || undefined,
        reflectionNotes: reflectionNotes || undefined,
      });

      if (!checkIn) {
        return "Failed to record goal check-in";
      }

      return `Goal check-in recorded successfully`;
    } catch (error) {
      console.error('[check-in-goal] Error:', error);
      return `Error recording goal check-in: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "check_in_goal",
    description: "Record a check-in for a goal. Use this when the user provides a progress update, reflects on their goal, or reviews their progress.",
    schema: z.object({
      goalId: z.string().describe("Goal ID to check in on"),
      progressUpdate: z.string().optional().nullable().describe("Progress update description"),
      moodRating: z.number().min(1).max(5).optional().nullable().describe("Mood rating (1-5)"),
      confidenceLevel: z.number().min(1).max(5).optional().nullable().describe("Confidence level (1-5)"),
      obstaclesEncountered: z.array(z.string()).optional().nullable().describe("List of obstacles encountered"),
      winsAndProgress: z.array(z.string()).optional().nullable().describe("List of wins and progress made"),
      nextSteps: z.array(z.string()).optional().nullable().describe("List of next steps"),
      reflectionNotes: z.string().optional().nullable().describe("Reflection notes"),
    }),
  }
);
