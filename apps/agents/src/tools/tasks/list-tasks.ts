import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const listTasksTool = tool(
  async ({ status, category, priority, dueBefore, dueAfter }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const filters: any = {};

      if (status) filters.status = status;
      if (category) filters.category = category;
      if (priority) filters.priority = priority;
      if (dueBefore) filters.dueBefore = dueBefore;
      if (dueAfter) filters.dueAfter = dueAfter;

      const tasks = await supabaseService.getTasks(userId, filters);

      if (!tasks || tasks.length === 0) {
        return "No tasks found matching the criteria.";
      }

      const taskList = tasks.map((task, index) => {
        const dueStr = task.due_date ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})` : '';
        const priorityStr = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
        const statusStr = task.status ? ` - ${task.status}` : '';
        const categoryStr = task.category_name ? ` [${task.category_name}]` : (task.category ? ` [${task.category}]` : '');
        return `${index + 1}. ${task.title}${priorityStr}${categoryStr}${dueStr}${statusStr}\n   ID: ${task.id}`;
      }).join('\n');

      return `Found ${tasks.length} task(s):\n${taskList}`;
    } catch (error) {
      console.error('[list-tasks] Error:', error);
      return `Error listing tasks: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_tasks",
    description: "List tasks with optional filters. Use this to show the user their tasks, find specific tasks, or check what they need to do.",
    schema: z.object({
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional().nullable().describe("Filter by status"),
      category: z.string().optional().nullable().describe("Filter by category"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().nullable().describe("Filter by priority"),
      dueBefore: z.string().optional().nullable().describe("Show tasks due before this date (ISO format)"),
      dueAfter: z.string().optional().nullable().describe("Show tasks due after this date (ISO format)"),
    }),
  }
);
