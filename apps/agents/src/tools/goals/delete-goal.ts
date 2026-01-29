import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

/**
 * Delete Goal Tool
 *
 * Deletes a goal by searching for it with a text query or direct goalId.
 * Uses fuzzy matching on title and description for flexible deletion.
 *
 * Examples:
 * - "delete my fitness goal" → searches and deletes matching goal
 * - "delete goal about learning Spanish" → searches and deletes
 * - goalId: "abc-123" → directly deletes by ID
 */
export const deleteGoalTool = tool(
  async ({ goalId, searchQuery }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    let targetGoalId = goalId;

    // If no goalId provided, search for the goal
    if (!targetGoalId) {
      if (!searchQuery) {
        return "❌ Either goalId or searchQuery must be provided";
      }

      console.log('🔍 [DELETE-GOAL TOOL] Searching for goal to delete:', searchQuery);

      try {
        const supabaseService = getSupabaseService();
        const goals = await supabaseService.getGoals(userId);

        // Normalize search query - remove common words and split
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word =>
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at', 'my', 'about'].includes(word)
        );

        // Find matching goals with fuzzy logic
        const matchingGoals = goals.filter((goal: any) => {
          const searchText = `${goal.title} ${goal.description || ''}`.toLowerCase();

          // Check if any significant query words are in the goal text
          const hasMatch = queryWords.some(word => searchText.includes(word));

          // Or check if the search text contains the full query
          const hasFullMatch = searchText.includes(normalizedQuery);

          return hasMatch || hasFullMatch;
        });

        // Sort by relevance - prefer title matches
        matchingGoals.sort((a, b) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();

          const aMatches = queryWords.filter(word => aTitle.includes(word)).length;
          const bMatches = queryWords.filter(word => bTitle.includes(word)).length;

          return bMatches - aMatches;
        });

        if (matchingGoals.length > 0) {
          targetGoalId = matchingGoals[0].id;
          const goalToDelete = matchingGoals[0];
          console.log('✅ [DELETE-GOAL TOOL] Found goal to delete:', goalToDelete.title);

          // Delete the goal
          const supabaseService = getSupabaseService();
          const result = await supabaseService.deleteGoal(userId, goalToDelete.id, { source: 'agent', agentType: 'conversation' });

          if (!result.success) {
            return `❌ Failed to delete goal: ${result.error}`;
          }

          return `✅ GOAL: "${goalToDelete.title}" has been deleted`;
        } else {
          return `❌ No goal found matching: "${searchQuery}". Available goals: ${goals.map((g: any) => g.title).join(', ')}`;
        }
      } catch (error) {
        console.error('❌ [DELETE-GOAL TOOL] Search error:', error);
        return `❌ Failed to find goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    if (!targetGoalId) {
      return "❌ Failed to identify goal to delete - this should not happen";
    }

    // Direct goalId provided - fetch goal details first, then delete
    try {
      const supabaseService = getSupabaseService();

      // Get goal details before deleting
      const goals = await supabaseService.getGoals(userId);
      const goalToDelete = goals.find((g: any) => g.id === targetGoalId);

      const result = await supabaseService.deleteGoal(userId, targetGoalId, { source: 'agent', agentType: 'conversation' });

      if (!result.success) {
        return `❌ Failed to delete goal: ${result.error}`;
      }

      // Format response with goal details
      if (goalToDelete) {
        return `✅ GOAL: "${goalToDelete.title}" has been deleted`;
      }

      return `✅ Goal deleted successfully`;
    } catch (error) {
      console.error('❌ [delete-goal] Error:', error);
      return `❌ Error deleting goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_goal",
    description: "Delete a goal by searching for it with a text query. Finds the goal using fuzzy matching on title and description. Use this when users want to remove or cancel a goal.",
    schema: z.object({
      goalId: z.string().optional().nullable().describe("Goal ID to delete (optional - rarely used, prefer searchQuery)"),
      searchQuery: z.string().describe("Search query to find and delete the goal. Examples: 'fitness goal', 'learn Spanish', 'read 50 books'. The tool will fuzzy match against goal titles and descriptions."),
    }),
  }
);
