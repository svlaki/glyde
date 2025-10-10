import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Search Group Patterns Tool
 *
 * Searches the shared group graph for:
 * - Common productivity patterns across all users
 * - Optimal scheduling recommendations
 * - Task duration benchmarks
 * - Successful strategies and best practices
 *
 * This searches the GROUP graph, not user-specific data.
 */
export const searchGroupPatternsTool = tool(
  async ({ query, limit }, config) => {
    try {
      // Import ZepGraphService to avoid circular dependencies
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();

      // Search the central graph for community patterns
      // Returns string[] with formatted pattern descriptions
      const minUsers = 3; // Minimum users required for community pattern
      const communityPatterns = await graphService.searchCommunityPatterns(query, minUsers);

      if (communityPatterns.length > 0) {
        const topPatterns = communityPatterns
          .slice(0, limit || 10)
          .map((pattern, i) => `${i + 1}. ${pattern}`)
          .join('\n');

        return `🌐 **Community Insights** for "${query}":\n\n💡 **Patterns Discovered Across Users:**\n${topPatterns}\n\n*These patterns are validated across ${minUsers}+ users with high confidence scores.*`;
      } else {
        return `🌐 No community patterns found for "${query}". This might be a unique use case not yet discovered across multiple users. Building intelligence as more users adopt similar practices.`;
      }
    } catch (error) {
      console.error('Failed to search group patterns:', error);
      return `🌐 Group pattern search temporarily unavailable.`;
    }
  },
  {
    name: "search_group_patterns",
    description: "Search shared knowledge graph for common patterns, best practices, and insights discovered across all users. Use this to provide recommendations based on collective intelligence.",
    schema: z.object({
      query: z.string().describe("Search query for group patterns (e.g., 'optimal deep work hours', 'average meeting duration', 'successful goal strategies')"),
      limit: z.number().optional().default(10).describe("Maximum number of results to return")
    }),
  }
);
