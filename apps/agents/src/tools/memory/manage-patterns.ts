import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Unified Pattern Management Tool
 *
 * Consolidates pattern management into a single interface:
 * - add-user: Record behavioral patterns to user's personal graph
 * - add-community: Record cross-user patterns to community graph
 *
 * This unified tool reduces LLM confusion and maintains clear semantics.
 */
export const managePatternsTool = tool(
  async ({ action, patternType, description, frequency, confidence, userCount, avgConfidence, category }, config) => {
    try {
      // Import ZepGraphService to avoid circular dependencies
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();

      // Action: Add user-specific pattern
      if (action === 'add-user') {
        const userId = config?.configurable?.userId;
        if (!userId) {
          throw new Error("User ID is required to add user pattern");
        }

        if (!frequency || confidence === undefined) {
          throw new Error("frequency and confidence are required for user patterns");
        }

        await graphService.addUserPattern(userId, {
          pattern_type: patternType,
          description,
          confidence_score: confidence,
          frequency
        });

        return `✅ Pattern recorded: "${description}" (${patternType}, ${frequency}, confidence: ${confidence})`;
      }

      // Action: Add community pattern
      if (action === 'add-community') {
        if (!userCount || avgConfidence === undefined || !category) {
          throw new Error("userCount, avgConfidence, and category are required for community patterns");
        }

        await graphService.addCommunityPattern({
          pattern_type: patternType,
          description,
          user_count: userCount,
          avg_confidence: avgConfidence,
          pattern_category: category
        });

        return `✅ Added community pattern: "${patternType}" (observed in ${userCount} users, ${Math.round(avgConfidence * 100)}% confidence)`;
      }

      return `❌ Invalid action: ${action}`;

    } catch (error) {
      console.error('Failed to manage pattern:', error);
      return `❌ Failed to ${action === 'add-user' ? 'record user' : 'add community'} pattern: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "manage_patterns",
    description: `Manage behavioral patterns in user or community knowledge graphs.

**Action: 'add-user'** - Record patterns to user's personal graph:
- Peak productivity hours, meeting preferences, task completion tendencies
- Energy fluctuations, scheduling preferences
- Requires: frequency, confidence

**Action: 'add-community'** - Record patterns to community graph:
- Cross-user behavioral patterns for collective intelligence
- Optimal productivity times, common scheduling preferences
- Requires: userCount, avgConfidence, category

Use this to remember long-term behaviors and improve recommendations.`,
    schema: z.object({
      action: z.enum(["add-user", "add-community"]).describe("Action: 'add-user' for personal patterns, 'add-community' for cross-user patterns"),
      patternType: z.string().describe("Type of pattern (e.g., 'peak_productivity_hours', 'meeting_preference', 'task_completion_rate')"),
      description: z.string().describe("Human-readable description of the pattern"),

      // User pattern parameters (required for add-user)
      frequency: z.enum(["daily", "weekly", "monthly", "rare"]).optional().describe("How often pattern occurs (required for add-user)"),
      confidence: z.number().min(0).max(1).optional().describe("Confidence in pattern 0-1 (required for add-user)"),

      // Community pattern parameters (required for add-community)
      userCount: z.number().optional().describe("Number of users exhibiting pattern (required for add-community)"),
      avgConfidence: z.number().min(0).max(1).optional().describe("Average confidence across users (required for add-community)"),
      category: z.string().optional().describe("Pattern category like 'productivity', 'scheduling' (required for add-community)")
    }),
  }
);
