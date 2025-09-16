import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const searchMemoryTool = tool(
  async ({ query, contextType }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for memory search");
    }

    try {
      // Import ZepMemoryService here to avoid circular dependencies
      const { ZepMemoryService } = await import('../../services/ZepMemoryService.js');
      const zepService = new ZepMemoryService();

      const searchResults = await zepService.searchMemory(
        userId,
        query,
        10 // limit to 10 results
      );

      if (searchResults.length > 0) {
        const formattedResults = searchResults
          .slice(0, 5) // Take top 5 results
          .map((item: any, index: number) => `${index + 1}. ${JSON.stringify(item)}`)
          .join('\n');

        return `🧠 Memory search results for "${query}":\n${formattedResults}`;
      } else {
        return `🧠 No relevant memories found for "${query}". This might be the first time this topic has come up.`;
      }
    } catch (error) {
      console.error('Failed to search Zep memory:', error);
      return `🧠 Memory search temporarily unavailable. Using conversation context instead.`;
    }
  },
  {
    name: "search_memory",
    description: "Search user's long-term memory and behavioral patterns using Zep memory service. Use this to understand user preferences, habits, goals, and past experiences relevant to current conversation.",
    schema: z.object({
      query: z.string().describe("Search query for user's memory (e.g., 'work habits', 'meeting preferences', 'productivity patterns', 'goal progress')"),
      contextType: z.enum(["conversation", "task_planning", "goal_coaching"]).nullable().describe("Type of context to search (defaults to 'conversation')"),
    }),
  }
);