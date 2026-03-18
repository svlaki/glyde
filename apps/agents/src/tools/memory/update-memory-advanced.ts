import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Advanced memory update tool that allows the LLM to proactively persist
 * important insights, preferences, and patterns during conversations.
 *
 * This complements the automatic persistence that happens at the end of
 * every conversation, allowing the agent to save breakthrough insights
 * immediately with rich metadata.
 */
export const updateMemoryAdvancedTool = tool(
  async ({ insights, importance, category, triggerEarlyPersistence = false, metadata }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for memory updates");
    }

    try {
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();
      const sessionId = config?.configurable?.sessionId || `session-${userId}`;

      // Build memory entry with rich metadata
      const memoryEntry = {
        userId,
        sessionId,
        insights,
        importance,
        category,
        timestamp: new Date().toISOString(),
        metadata: metadata || {},
        source: 'agent_proactive' // Distinguish from automatic persistence
      };

      // If early persistence is requested, save immediately to Zep
      if (triggerEarlyPersistence) {
        // Create a formatted fact string from insights
        const factsString = insights
          .map((insight, i) => `${i + 1}. ${insight}`)
          .join('\n');

        // Add each insight as a user pattern to the graph
        // This uses the existing addUserPattern method
        for (const insight of insights) {
          await graphService.addUserPattern(userId, {
            pattern_type: category,
            description: insight,
            confidence_score: importance === 'high' ? 0.9 : importance === 'medium' ? 0.7 : 0.5,
            frequency: 'weekly' // Default frequency for manually captured insights
          });
        }

        console.log(`💾 [MEMORY ADVANCED] Immediately persisted ${insights.length} insights for user ${userId}`);

        return `**Memory Updated** (${importance} importance)
Saved ${insights.length} insight${insights.length > 1 ? 's' : ''} to your ${category} memory:
${insights.map((insight, i) => `  ${i + 1}. ${insight}`).join('\n')}

These insights will help me better understand your preferences and provide more personalized assistance.`;
      }

      // Otherwise, queue for batch persistence at conversation end
      // Store in session metadata for later processing
      const sessionMetadata = config?.configurable?.sessionMetadata || {};
      if (!sessionMetadata.queuedInsights) {
        sessionMetadata.queuedInsights = [];
      }
      sessionMetadata.queuedInsights.push(memoryEntry);

      console.log(`[MEMORY ADVANCED] Queued ${insights.length} insights for batch persistence (user ${userId})`);

      return `**Noted** (${importance} importance)
I've recorded ${insights.length} insight${insights.length > 1 ? 's' : ''} about your ${category} preferences. These will be saved to help personalize future interactions.`;

    } catch (error) {
      console.error('Failed to update memory:', error);
      return `Memory update temporarily unavailable. Your insights were noted for this conversation but may not persist long-term. Please try again later.`;
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
