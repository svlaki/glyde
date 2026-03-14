import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const listTasksTool = tool(
  async ({ status, aspect, priority, dueBefore, dueAfter }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const filters: any = {};

      if (status) filters.status = status;
      if (aspect) filters.aspect = aspect;
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
        const aspectStr = task.aspect_name ? ` [${task.aspect_name}]` : (task.aspect ? ` [${task.aspect}]` : '');
        return `${index + 1}. ${task.title}${priorityStr}${aspectStr}${dueStr}${statusStr}\n   ID: ${task.id}`;
      }).join('\n');

      return `Found ${tasks.length} task(s):\n${taskList}`;
    } catch (error) {
      console.error('[list-tasks] Error:', error);
      return `Error listing tasks: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_tasks",
    description: "List tasks with optional filters.",
    schema: z.object({
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional().nullable().describe("Filter by status"),
      aspect: z.string().optional().nullable().describe("Filter by aspect"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().nullable().describe("Filter by priority"),
      dueBefore: z.string().optional().nullable().describe("Due before date ISO"),
      dueAfter: z.string().optional().nullable().describe("Due after date ISO"),
    }),
  }
);
