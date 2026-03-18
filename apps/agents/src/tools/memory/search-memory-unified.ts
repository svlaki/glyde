import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Unified Memory Search Tool
 *
 * Consolidates 4 separate memory search tools into one clear interface:
 * - search-memory (basic Zep search)
 * - search-user-memory (user graph + community)
 * - search-group-patterns (community only)
 * - search-user-graph (user graph with entity filtering)
 *
 * This unified tool provides all capabilities with a clear mode parameter.
 */
export const searchMemoryUnifiedTool = tool(
  async ({ query, mode = "all", entityType, minFactRating }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for memory search");
    }

    try {
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();
      const sessionId = config?.configurable?.sessionId || `session-${userId}`;

      // Mode: 'personal' - Search user's personal patterns only
      if (mode === 'personal') {
        let searchResults;

        // If entity type specified, use advanced search with filtering
        if (entityType) {
          const entityTypeMap: Record<string, string[]> = {
            'calendar': ['CalendarEvent'],
            'task': ['Task'],
            'goal': ['Goal'],
            'pattern': ['Pattern']
          };

          searchResults = await graphService.searchUserGraphAdvanced(userId, query, {
            entityTypes: entityTypeMap[entityType],
            scope: 'edges',
            minRating: minFactRating || 0.6
          });

          if (searchResults.edges && searchResults.edges.length > 0) {
            const formatted = searchResults.edges
              .slice(0, 10)
              .map((edge: any, i: number) =>
                `${i + 1}. ${edge.fact?.description || edge.name || 'Pattern found'}`
              )
              .join('\n');

            return `🔍 **Personal ${entityType} patterns** for "${query}":\n${formatted}`;
          }
        } else {
          // General personal search without entity filtering
          searchResults = await graphService.searchHighQualityPatterns(userId, query);

          if (searchResults.edges && searchResults.edges.length > 0) {
            const formatted = searchResults.edges
              .slice(0, 10)
              .map((edge: any, i: number) =>
                `${i + 1}. ${edge.fact?.description || 'Pattern: ' + edge.name}`
              )
              .join('\n');

            return `🔍 **Personal patterns** for "${query}":\n${formatted}`;
          }
        }

        return `🔍 No personal patterns found for "${query}". This might be a new topic for you.`;
      }

      // Mode: 'community' - Search shared community patterns only
      if (mode === 'community') {
        const minUsers = 3;
        const communityPatterns = await graphService.searchCommunityPatterns(query, minUsers);

        if (communityPatterns.length > 0) {
          const topPatterns = communityPatterns
            .slice(0, 10)
            .map((pattern, i) => `${i + 1}. ${pattern}`)
            .join('\n');

          return `**Community Insights** for "${query}":\n\n**Patterns Discovered Across Users:**\n${topPatterns}\n\n*Validated across ${minUsers}+ users with high confidence.*`;
        }

        return `No community patterns found for "${query}". This might be a unique use case.`;
      }

      // Mode: 'all' (default) - Search both personal and community
      const context = await graphService.getEnhancedUserContext(userId, sessionId);

      if (!context.memory_context || context.memory_context.length === 0) {
        return `🔍 No relevant memories found for "${query}". This might be a new topic.`;
      }

      const sections: string[] = [];

      // Add memory context (includes patterns and insights)
      sections.push('**Your Memory Context:**');
      sections.push(context.memory_context);

      // Add high-value facts if available and rating threshold specified
      if (context.facts && context.facts.length > 0 && minFactRating) {
        const highValueFacts = context.facts
          .filter((f: any) => (f.rating || 0) >= minFactRating)
          .slice(0, 5);

        if (highValueFacts.length > 0) {
          sections.push('\n**High-Value Facts:**');
          highValueFacts.forEach((fact: any, i: number) => {
            sections.push(`${i + 1}. ${fact.fact} (confidence: ${Math.round((fact.rating || 0) * 100)}%)`);
          });
        }
      }

      return sections.join('\n');

    } catch (error) {
      console.error('Failed to search memory:', error);
      return `🔍 Memory search temporarily unavailable. Using conversation context instead.`;
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
