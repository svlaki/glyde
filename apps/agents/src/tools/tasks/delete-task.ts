import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const deleteTaskTool = tool(
  async ({ taskId, searchQuery }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    let targetTaskId = taskId;

    // If no taskId provided, search for the task
    if (!targetTaskId) {
      if (!searchQuery) {
        return "❌ Either taskId or searchQuery must be provided";
      }

      console.log('🔍 [DELETE-TASK TOOL] Searching for task to delete:', searchQuery);

      try {
        const supabaseService = getSupabaseService();
        const tasks = await supabaseService.getTasks(userId);

        // Normalize search query - remove common words and split
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word =>
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at'].includes(word)
        );

        // Find matching tasks with fuzzy logic
        const matchingTasks = tasks.filter((task: any) => {
          const searchText = `${task.title} ${task.description || ''}`.toLowerCase();

          // Check if any significant query words are in the task text
          const hasMatch = queryWords.some(word => searchText.includes(word));

          // Or check if the search text contains the full query
          const hasFullMatch = searchText.includes(normalizedQuery);

          return hasMatch || hasFullMatch;
        });

        // Sort by relevance - prefer title matches
        matchingTasks.sort((a, b) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();

          const aMatches = queryWords.filter(word => aTitle.includes(word)).length;
          const bMatches = queryWords.filter(word => bTitle.includes(word)).length;

          return bMatches - aMatches;
        });

        if (matchingTasks.length > 0) {
          targetTaskId = matchingTasks[0].id;
          // Store task details for the response
          const taskToDelete = matchingTasks[0];
          console.log('✅ [DELETE-TASK TOOL] Found task to delete:', taskToDelete.title);

          // Delete the task
          const supabaseService = getSupabaseService();
          const result = await supabaseService.deleteTask(userId, taskToDelete.id);

          if (!result.success) {
            return `❌ Failed to delete task: ${result.error}`;
          }

          // Format due date for response
          let dueInfo = '';
          if (taskToDelete.due_date) {
            const dueDate = new Date(taskToDelete.due_date);
            const dateStr = dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            const timeStr = dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            dueInfo = ` (was due ${dateStr} at ${timeStr})`;
          }

          return `✅ TASK: "${taskToDelete.title}" has been deleted${dueInfo}`;
        } else {
          return `❌ No task found matching: "${searchQuery}". Available tasks: ${tasks.map((t: any) => t.title).join(', ')}`;
        }
      } catch (error) {
        console.error('❌ [DELETE-TASK TOOL] Search error:', error);
        return `❌ Failed to find task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    if (!targetTaskId) {
      return "❌ Failed to identify task to delete - this should not happen";
    }

    // Direct taskId provided - fetch task details first, then delete
    try {
      const supabaseService = getSupabaseService();

      // Get task details before deleting
      const tasks = await supabaseService.getTasks(userId);
      const taskToDelete = tasks.find((t: any) => t.id === targetTaskId);

      const result = await supabaseService.deleteTask(userId, targetTaskId);

      if (!result.success) {
        return `❌ Failed to delete task: ${result.error}`;
      }

      // Format response with task details
      if (taskToDelete) {
        let dueInfo = '';
        if (taskToDelete.due_date) {
          const dueDate = new Date(taskToDelete.due_date);
          const dateStr = dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          const timeStr = dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          dueInfo = ` (was due ${dateStr} at ${timeStr})`;
        }
        return `✅ TASK: "${taskToDelete.title}" has been deleted${dueInfo}`;
      }

      return `✅ Task deleted successfully`;
    } catch (error) {
      console.error('❌ [delete-task] Error:', error);
      return `❌ Error deleting task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_task",
    description: "Delete a task by searching for it with a text query. Finds the task using fuzzy matching on title and description.",
    schema: z.object({
      taskId: z.string().optional().nullable().describe("Task ID to delete (optional - rarely used, prefer searchQuery)"),
      searchQuery: z.string().describe("Search query to find and delete the task. Examples: 'cs 221', 'buy groceries', 'workout'. The tool will fuzzy match against task titles and descriptions."),
    }),
  }
);
