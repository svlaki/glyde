import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Advanced memory update tool that allows the LLM to proactively persist
 * important insights, preferences, and patterns during conversations.
 */
export const updateMemoryAdvancedTool = tool(
  async ({ insights, importance, category, triggerEarlyPersistence = false, metadata }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for memory updates");
    }

    try {
      const { MemoryService } = await import('../../services/MemoryService.js');
      const memoryService = MemoryService.getInstance();

      const confidenceMap: Record<string, number> = {
        high: 0.9,
        medium: 0.7,
        low: 0.5,
      };

      if (triggerEarlyPersistence) {
        // Save each insight immediately as a memory fact
        for (const insight of insights) {
          await memoryService.addFact(
            userId,
            insight,
            category === 'patterns' ? 'pattern' : category === 'preferences' ? 'preference' : 'insight',
            'agent_proactive',
            confidenceMap[importance] || 0.7,
            metadata || {}
          );
        }

        console.log(`[MEMORY ADVANCED] Persisted ${insights.length} insights for user ${userId}`);

        return `**Memory Updated** (${importance} importance)
Saved ${insights.length} insight${insights.length > 1 ? 's' : ''} to your ${category} memory:
${insights.map((insight, i) => `  ${i + 1}. ${insight}`).join('\n')}

These insights will help me better understand your preferences and provide more personalized assistance.`;
      }

      // Queue for batch persistence — store as patterns with lower priority
      for (const insight of insights) {
        await memoryService.addFact(
          userId,
          insight,
          category === 'patterns' ? 'pattern' : category === 'preferences' ? 'preference' : 'insight',
          'agent_proactive',
          confidenceMap[importance] || 0.7,
          metadata || {}
        );
      }

      console.log(`[MEMORY ADVANCED] Saved ${insights.length} insights for user ${userId}`);

      return `**Noted** (${importance} importance)
I've recorded ${insights.length} insight${insights.length > 1 ? 's' : ''} about your ${category} preferences. These will be saved to help personalize future interactions.`;

    } catch (error) {
      console.error('Failed to update memory:', error);
      return `Memory update temporarily unavailable. Your insights were noted for this conversation but may not persist long-term.`;
    }
  },
  {
    name: "update_memory_advanced",
    description: "Save insights and preferences to user memory.",
    schema: z.object({
      insights: z.array(z.string()).describe("Insights to persist"),
      importance: z.enum(["low", "medium", "high"]).describe("Importance level"),
      category: z.string().describe("Category (e.g., preferences, patterns)"),
      triggerEarlyPersistence: z.boolean().default(false).nullable().describe("Save immediately if true"),
      metadata: z.record(z.any()).optional().nullable().describe("Additional context (JSON)")
    }),
  }
);
