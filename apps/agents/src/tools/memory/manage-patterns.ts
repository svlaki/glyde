import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Pattern Management Tool
 *
 * Records behavioral patterns to user memory via MemoryService.
 */
export const managePatternsTool = tool(
  async ({ action, patternType, description, frequency, confidence }, config) => {
    try {
      const userId = config?.configurable?.userId;
      if (!userId) {
        throw new Error("User ID is required to add pattern");
      }

      const { MemoryService } = await import('../../services/MemoryService.js');
      const memoryService = MemoryService.getInstance();

      if (action === 'add-user') {
        if (!frequency || confidence === undefined) {
          throw new Error("frequency and confidence are required for user patterns");
        }

        await memoryService.addFact(
          userId,
          description,
          'pattern',
          'agent_proactive',
          confidence!,
          { patternType, frequency }
        );

        return `Pattern recorded: "${description}" (${patternType}, ${frequency}, confidence: ${confidence})`;
      }

      // Community patterns not supported — single-user system
      if (action === 'add-community') {
        return `Community patterns are not supported. Use "add-user" to record personal patterns.`;
      }

      return `Invalid action: ${action}`;

    } catch (error) {
      console.error('Failed to manage pattern:', error);
      return `Failed to record pattern: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "manage_patterns",
    description: "Record behavioral patterns to user memory.",
    schema: z.object({
      action: z.enum(["add-user", "add-community"]).describe("Target (add-user recommended)"),
      patternType: z.string().describe("Pattern type identifier"),
      description: z.string().describe("Pattern description"),
      frequency: z.enum(["daily", "weekly", "monthly", "rare"]).optional().nullable().describe("Frequency (for add-user)"),
      confidence: z.number().min(0).max(1).optional().nullable().describe("Confidence 0-1 (for add-user)"),
      userCount: z.number().optional().nullable().describe("Deprecated - not used"),
      avgConfidence: z.number().min(0).max(1).optional().nullable().describe("Deprecated - not used"),
      category: z.string().optional().nullable().describe("Deprecated - not used")
    }),
  }
);
