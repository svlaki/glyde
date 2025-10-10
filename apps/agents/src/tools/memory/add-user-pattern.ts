import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Add User Pattern Tool
 *
 * Records a detected behavioral pattern to the user's personal graph.
 * Patterns can include:
 * - Peak productivity hours
 * - Meeting preferences
 * - Task completion tendencies
 * - Energy fluctuations
 * - Scheduling preferences
 */
export const addUserPatternTool = tool(
  async ({ patternType, description, frequency, confidence }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required to add pattern");
    }

    try {
      // Import ZepGraphService to avoid circular dependencies
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();

      // Add to user's graph using the new addUserPattern method
      await graphService.addUserPattern(userId, {
        pattern_type: patternType,
        description,
        confidence_score: confidence,
        frequency
      });

      return `✅ Pattern recorded: "${description}" (${patternType}, ${frequency}, confidence: ${confidence})`;
    } catch (error) {
      console.error('Failed to add user pattern:', error);
      return `❌ Failed to record pattern. It will be noted in conversation context instead.`;
    }
  },
  {
    name: "add_user_pattern",
    description: "Record a detected behavioral pattern to the user's knowledge graph. Use this when you observe consistent behaviors, preferences, or tendencies that should be remembered long-term.",
    schema: z.object({
      patternType: z.enum([
        "peak_productivity_hours",
        "meeting_overload",
        "task_completion_rate",
        "goal_achievement",
        "energy_fluctuation",
        "scheduling_preference",
        "other"
      ]).describe("Category of the detected pattern"),
      description: z.string().describe("Human-readable description of the pattern (e.g., 'Most productive between 9-11am')"),
      frequency: z.enum(["daily", "weekly", "monthly", "rare"]).describe("How often this pattern occurs"),
      confidence: z.number().min(0).max(1).describe("Confidence in this pattern (0-1, where 1 is very confident)")
    }),
  }
);
