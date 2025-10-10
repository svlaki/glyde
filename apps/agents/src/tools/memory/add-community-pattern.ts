/**
 * Add Community Pattern Tool
 *
 * Adds cross-user patterns to the central graph for collective intelligence
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const addCommunityPatternTool = tool(
  async ({ patternType, description, userCount, avgConfidence, category }) => {
    try {
      // Import ZepGraphService to avoid circular dependencies
      const { ZepGraphService } = await import('../../services/ZepGraphService.js');
      const graphService = new ZepGraphService();

      // Add pattern to central graph
      await graphService.addCommunityPattern({
        pattern_type: patternType,
        description,
        user_count: userCount,
        avg_confidence: avgConfidence,
        pattern_category: category
      });

      return `✅ Added community pattern: "${patternType}" (observed in ${userCount} users, ${Math.round(avgConfidence * 100)}% confidence)`;

    } catch (error) {
      console.error('Failed to add community pattern:', error);
      return `❌ Failed to add community pattern. Please try again.`;
    }
  },
  {
    name: "add_community_pattern",
    description: `Add a cross-user behavioral pattern to the central knowledge graph.

Use this when you detect patterns that are common across multiple users, such as:
- Optimal productivity times (e.g., "Most users are productive 9-11am")
- Common scheduling preferences (e.g., "Users prefer meetings in afternoons")
- Task completion patterns (e.g., "Tasks estimated at 1hr typically take 1.5hrs")
- Energy management strategies (e.g., "Users schedule breaks after 2hrs of deep work")

These patterns help improve recommendations for all users based on collective wisdom.`,
    schema: z.object({
      patternType: z.string().describe("Type of pattern (e.g., 'peak_productivity_hours', 'meeting_preference', 'task_duration_accuracy')"),
      description: z.string().describe("Human-readable description of the pattern"),
      userCount: z.number().describe("Number of users exhibiting this pattern"),
      avgConfidence: z.number().min(0).max(1).describe("Average confidence score across users (0.0-1.0)"),
      category: z.string().describe("Pattern category (e.g., 'productivity', 'scheduling', 'energy', 'task_management')")
    }),
  }
);
