import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Unified Memory Search Tool
 *
 * Searches user memory facts via pgvector semantic similarity.
 * Modes: personal (user facts), all (user facts + context summary).
 */
export const searchMemoryUnifiedTool = tool(
  async ({ query, mode = "all", entityType, minFactRating }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for memory search");
    }

    try {
      const { MemoryService } = await import('../../services/MemoryService.js');
      const memoryService = MemoryService.getInstance();

      // Map entity types to fact categories
      const categoryMap: Record<string, string> = {
        'calendar': 'behavioral',
        'task': 'behavioral',
        'goal': 'insight',
        'pattern': 'pattern'
      };

      if (mode === 'personal' || mode === 'all') {
        const results = await memoryService.searchFacts(userId, query, {
          category: entityType ? categoryMap[entityType] : undefined,
          minConfidence: minFactRating || 0.0,
          limit: 10,
        });

        if (results.length > 0) {
          const formatted = results
            .map((fact, i) =>
              `${i + 1}. ${fact.content} (confidence: ${Math.round(fact.confidence * 100)}%)`
            )
            .join('\n');

          let output = `**Memory results** for "${query}":\n${formatted}`;

          // In 'all' mode, also include the cached context summary
          if (mode === 'all') {
            const context = await memoryService.getUserContext(userId);
            if (context) {
              output += `\n\n**Your Context Summary:**\n${context}`;
            }
          }

          return output;
        }

        // No search results — try returning context summary
        if (mode === 'all') {
          const context = await memoryService.getUserContext(userId);
          if (context) {
            return `No specific matches for "${query}", but here's your context:\n${context}`;
          }
        }

        return `No memories found for "${query}". This might be a new topic for you.`;
      }

      // Community mode — not supported in pgvector system
      if (mode === 'community') {
        return `Community pattern search is not available. Use "personal" or "all" mode instead.`;
      }

      return `No memories found for "${query}".`;

    } catch (error) {
      console.error('Failed to search memory:', error);
      return `Memory search temporarily unavailable. Using conversation context instead.`;
    }
  },
  {
    name: "search_memory_unified",
    description: "Search user memory and behavioral patterns.",
    schema: z.object({
      query: z.string().describe("Search query"),
      mode: z.enum(["personal", "community", "all"]).default("all").nullable().describe("Search mode"),
      entityType: z.enum(["calendar", "task", "goal", "pattern"]).optional().nullable().describe("Filter by entity type"),
      minFactRating: z.number().min(0).max(1).optional().nullable().describe("Min confidence 0-1")
    }),
  }
);
