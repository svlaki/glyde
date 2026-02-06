import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

/**
 * Search Tasks Tool
 *
 * Searches tasks by text content in title and description fields.
 * Complements list-tasks by providing content-based search with optional filters.
 *
 * Use this when:
 * - User asks to "find tasks about X"
 * - Searching for tasks with specific keywords
 * - Need partial/fuzzy matching on task content
 *
 * Use list-tasks when:
 * - Listing all tasks with specific filters (status, priority, category, dates)
 * - No text search needed
 */
export const searchTasksTool = tool(
  async ({ query, status, aspect, priority, dueBefore, dueAfter }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    if (!query || query.trim().length === 0) {
      return "Search query is required. Use list_tasks to list all tasks with filters.";
    }

    try {
      const supabaseService = getSupabaseService();

      // Get all tasks (filters will be applied after text search)
      const allTasks = await supabaseService.getTasks(userId);

      if (!allTasks || allTasks.length === 0) {
        return "No tasks found.";
      }

      // Normalize query for case-insensitive partial matching
      const normalizedQuery = query.toLowerCase().trim();

      // Text search on title and description
      let matchedTasks = allTasks.filter((task) => {
        const title = (task.title || '').toLowerCase();
        const description = (task.description || '').toLowerCase();
        return title.includes(normalizedQuery) || description.includes(normalizedQuery);
      });

      if (matchedTasks.length === 0) {
        return `No tasks found matching "${query}".`;
      }

      // Apply additional filters if provided
      if (status) {
        matchedTasks = matchedTasks.filter((t) => t.status === status);
      }
      if (aspect) {
        const normalizedAspect = aspect.toLowerCase().trim();
        matchedTasks = matchedTasks.filter((t) => {
          const aspectName = (t.aspect_name || t.aspect || '').toLowerCase();
          return aspectName === normalizedAspect || aspectName.includes(normalizedAspect);
        });
      }
      if (priority) {
        matchedTasks = matchedTasks.filter((t) => t.priority === priority);
      }
      if (dueBefore) {
        matchedTasks = matchedTasks.filter((t) => t.due_date && t.due_date <= dueBefore);
      }
      if (dueAfter) {
        matchedTasks = matchedTasks.filter((t) => t.due_date && t.due_date >= dueAfter);
      }

      if (matchedTasks.length === 0) {
        return `No tasks found matching "${query}" with the specified filters.`;
      }

      // Format results
      const taskList = matchedTasks.map((task, index) => {
        const dueStr = task.due_date ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})` : '';
        const priorityStr = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
        const statusStr = task.status ? ` - ${task.status}` : '';
        const aspectStr = task.aspect_name ? ` [${task.aspect_name}]` : (task.aspect ? ` [${task.aspect}]` : '');
        const descriptionPreview = task.description ? ` - ${task.description.substring(0, 60)}${task.description.length > 60 ? '...' : ''}` : '';
        return `${index + 1}. ${task.title}${priorityStr}${aspectStr}${dueStr}${statusStr}${descriptionPreview}`;
      }).join('\n');

      return `🔍 Found ${matchedTasks.length} task(s) matching "${query}":\n${taskList}`;
    } catch (error) {
      console.error('[search-tasks] Error:', error);
      return `Error searching tasks: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "search_tasks",
    description: "Search tasks by text content in title and description. Use this to find tasks containing specific keywords or phrases. Supports optional filters for status, aspect, priority, and due dates.",
    schema: z.object({
      query: z.string().describe("Search query to match in task title or description (case-insensitive, partial matching)"),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional().nullable().describe("Optional: Filter by status"),
      aspect: z.string().optional().nullable().describe("Optional: Filter by aspect"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().nullable().describe("Optional: Filter by priority"),
      dueBefore: z.string().optional().nullable().describe("Optional: Show tasks due before this date (ISO format)"),
      dueAfter: z.string().optional().nullable().describe("Optional: Show tasks due after this date (ISO format)"),
    }),
  }
);
