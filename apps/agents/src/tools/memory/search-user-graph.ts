import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Search User Graph Tool
 *
 * Searches the user's personal knowledge graph for:
 * - Calendar patterns (meeting times, scheduling preferences)
 * - Task completion patterns (productivity hours, task types)
 * - Goal progress and achievements
 * - Personal behavioral patterns
 *
 * This searches ONLY the user-specific graph, not shared patterns.
 */
export const searchUserGraphTool = tool(
  async ({ query, entityType, limit }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for user graph search");
    }

    try {
      // Import ZepGraphService to avoid circular dependencies
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();

      // Perform search using advanced search method
      let searchResults;

      switch (entityType) {
        case 'calendar':
          searchResults = await graphService.searchUserGraphAdvanced(userId, query, {
            entityTypes: ['CalendarEvent'],
            scope: 'edges',
            minRating: 0.6
          });
          break;
        case 'task':
          searchResults = await graphService.searchUserGraphAdvanced(userId, query, {
            entityTypes: ['Task'],
            scope: 'edges',
            minRating: 0.6
          });
          break;
        case 'goal':
          searchResults = await graphService.searchUserGraphAdvanced(userId, query, {
            entityTypes: ['Goal'],
            scope: 'edges',
            minRating: 0.6
          });
          break;
        case 'pattern':
          searchResults = await graphService.searchHighQualityPatterns(userId, query);
          break;
        default:
          // Generic search across all user data
          searchResults = await graphService.searchUserGraphAdvanced(userId, query, {
            scope: 'edges',
            minRating: 0.5
          });
      }

      // Format results
      const facts = searchResults.edges?.map((edge: any) => edge.fact).slice(0, limit) || [];
      const entities = searchResults.nodes?.map((node: any) => node.summary).slice(0, Math.min(3, limit)) || [];

      if (facts.length > 0 || entities.length > 0) {
        const formattedFacts = facts.length > 0
          ? `📊 Facts:\n${facts.map((f: any, i: number) => `${i + 1}. ${f?.description || JSON.stringify(f)}`).join('\n')}`
          : '';
        const formattedEntities = entities.length > 0
          ? `🎯 Entities:\n${entities.map((e: any, i: number) => `${i + 1}. ${e || 'Unknown'}`).join('\n')}`
          : '';

        return `🧠 User Graph Search Results for "${query}":\n\n${formattedFacts}\n\n${formattedEntities}`.trim();
      } else {
        return `🧠 No personal patterns found for "${query}". This might be the first time tracking this type of data.`;
      }
    } catch (error) {
      console.error('Failed to search user graph:', error);
      return `🧠 User graph search temporarily unavailable. Using conversation context instead.`;
    }
  },
  {
    name: "search_user_graph",
    description: "Search user's personal knowledge graph for calendar patterns, task histories, goals, and behavioral insights. Use this to understand the user's specific habits, preferences, and tracked data.",
    schema: z.object({
      query: z.string().describe("Search query for user's personal data (e.g., 'morning meetings', 'task completion times', 'fitness goals')"),
      entityType: z.enum(["calendar", "task", "goal", "pattern", "all"]).describe("Type of entity to search for (defaults to 'all')"),
      limit: z.number().optional().default(10).describe("Maximum number of results to return")
    }),
  }
);
