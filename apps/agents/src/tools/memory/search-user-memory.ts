/**
 * Search User Memory Tool
 *
 * Uses Zep's thread.get_user_context for unified retrieval across
 * conversation history and user's knowledge graph
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const searchUserMemoryTool = tool(
  async ({ query, mode, minFactRating }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for memory search");
    }

    try {
      // Import ZepGraphService for enhanced memory with Zep v3 features
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();

      // Use session ID if available, otherwise create one from userId
      const sessionId = config?.configurable?.sessionId || `session-${userId}`;

      // Get enhanced user context with user patterns + community insights
      const context = await graphService.getEnhancedUserContext(userId, sessionId);

      if (!context.memory_context || context.memory_context.length === 0) {
        return `🔍 No relevant memories found for "${query}". This might be a new topic for you.`;
      }

      // Format the response with facts and context
      const sections: string[] = [];

      // Add memory context (includes patterns and insights)
      sections.push(context.memory_context);

      // Add high-value facts if available
      if (context.facts && context.facts.length > 0 && minFactRating) {
        const highValueFacts = context.facts
          .filter((f: any) => (f.rating || 0) >= (minFactRating || 0.7))
          .slice(0, 5)
          .map((f: any) => `• ${f.fact}`)
          .join('\n');

        if (highValueFacts) {
          sections.push(`\n💎 **High-Confidence Facts:**\n${highValueFacts}`);
        }
      }

      return sections.join('\n\n');

    } catch (error) {
      console.error('Failed to search user memory:', error);
      return `❌ Memory search temporarily unavailable. Using current conversation context only.`;
    }
  },
  {
    name: "search_user_memory",
    description: `Search your personal memory using Zep's unified retrieval system. This searches across:
1. Recent conversation history
2. Your personal knowledge graph (calendar, tasks, goals)
3. Detected behavioral patterns

Use this to recall past conversations, find related tasks, understand your preferences, or access your productivity patterns.`,
    schema: z.object({
      query: z.string().describe("What you want to remember or find (e.g., 'meetings last week', 'fitness goals', 'when did I last...')"),
      mode: z.enum(["basic", "summary"]).optional().default("basic").describe("Retrieval mode - 'basic' is faster (<200ms), 'summary' includes AI summarization"),
      minFactRating: z.number().optional().describe("Minimum confidence score for facts (0.0-1.0). Higher values = more reliable memories")
    }),
  }
);

