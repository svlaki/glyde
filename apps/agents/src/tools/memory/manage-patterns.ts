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
          confidence_score: confidence!,
          frequency: frequency!
        });

        return `Pattern recorded: "${description}" (${patternType}, ${frequency}, confidence: ${confidence})`;
      }

      // Action: Add community pattern
      if (action === 'add-community') {
        if (!userCount || avgConfidence === undefined || !category) {
          throw new Error("userCount, avgConfidence, and category are required for community patterns");
        }

        await graphService.addCommunityPattern({
          pattern_type: patternType,
          description,
          user_count: userCount!,
          avg_confidence: avgConfidence!,
          pattern_category: category!
        });

        return `Added community pattern: "${patternType}" (observed in ${userCount} users, ${Math.round(avgConfidence! * 100)}% confidence)`;
      }

      return `Invalid action: ${action}`;

    } catch (error) {
      console.error('Failed to manage pattern:', error);
      return `Failed to ${action === 'add-user' ? 'record user' : 'add community'} pattern: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "manage_patterns",
    description: "Record behavioral patterns to user or community graph.",
    schema: z.object({
      action: z.enum(["add-user", "add-community"]).describe("Target graph"),
      patternType: z.string().describe("Pattern type identifier"),
      description: z.string().describe("Pattern description"),
      frequency: z.enum(["daily", "weekly", "monthly", "rare"]).optional().nullable().describe("Frequency (for add-user)"),
      confidence: z.number().min(0).max(1).optional().nullable().describe("Confidence 0-1 (for add-user)"),
      userCount: z.number().optional().nullable().describe("User count (for add-community)"),
      avgConfidence: z.number().min(0).max(1).optional().nullable().describe("Avg confidence (for add-community)"),
      category: z.string().optional().nullable().describe("Category (for add-community)")
    }),
  }
);
