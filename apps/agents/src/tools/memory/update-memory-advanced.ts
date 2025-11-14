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
  async ({ insights, importance, category, triggerEarlyPersistence, metadata }, config) => {
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

        return `✅ **Memory Updated** (${importance} importance)
📝 Saved ${insights.length} insight${insights.length > 1 ? 's' : ''} to your ${category} memory:
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

      console.log(`📋 [MEMORY ADVANCED] Queued ${insights.length} insights for batch persistence (user ${userId})`);

      return `✅ **Noted** (${importance} importance)
I've recorded ${insights.length} insight${insights.length > 1 ? 's' : ''} about your ${category} preferences. These will be saved to help personalize future interactions.`;

    } catch (error) {
      console.error('Failed to update memory:', error);
      return `⚠️ Memory update temporarily unavailable. Your insights were noted for this conversation but may not persist long-term. Please try again later.`;
    }
  },
  {
    name: "update_memory_advanced",
    description: `Proactively save important insights, preferences, and patterns to user memory.

**Use this tool when:**
- User reveals important preferences (e.g., "I hate morning meetings")
- Breakthrough insights about goals or values (e.g., "I want to prioritize health over work")
- Significant behavioral patterns discovered (e.g., "User consistently reschedules Friday meetings")
- Major life events or context changes (e.g., "Starting new job next month")

**Don't use for:**
- Routine calendar/task operations (use specific tools)
- Temporary/one-time information
- Information already captured in events/tasks/goals

**Importance levels:**
- "high": Core preferences, values, major insights that should influence all recommendations
- "medium": Useful patterns and preferences that improve personalization
- "low": Minor observations that may be helpful context

**Early persistence:**
- Set triggerEarlyPersistence=true for critical insights that should save immediately
- Leave false (default) for insights that can wait until conversation end`,

    schema: z.object({
      insights: z.array(z.string()).describe("List of key insights to persist (e.g., ['Prefers morning deep work 9-11am', 'Dislikes meetings after 4pm'])"),
      importance: z.enum(["low", "medium", "high"]).describe("How important these insights are for future personalization"),
      category: z.string().describe("Category of insights (e.g., 'preferences', 'goals', 'patterns', 'scheduling', 'productivity', 'wellness')"),
      triggerEarlyPersistence: z.boolean().default(false).describe("If true, save immediately. If false, queue for batch save at conversation end."),
      metadata: z.record(z.any()).optional().describe("Optional additional context (e.g., {confidence: 0.95, detectedFrom: 'repeated behavior'})")
    }),
  }
);
