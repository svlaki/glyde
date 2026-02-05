import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createTaskTool = tool(
  async ({ title, description, dueDate, priority, category, energyRequired, estimatedDuration }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      const task = await supabaseService.createTask(userId, {
        title,
        description: description || undefined,
        dueDate: dueDate || undefined,
        priority: priority || 'medium',
        category: category || 'Personal',
        energyRequired: energyRequired || undefined,
        estimatedDuration: estimatedDuration || undefined,
      }, { source: 'agent', agentType: 'conversation' });

      if (!task) {
        return "Failed to create task";
      }

      const dueDateStr = dueDate ? ` (Due: ${new Date(dueDate).toLocaleDateString()})` : '';
      return `Task created: "${title}"${dueDateStr}`;
    } catch (error) {
      console.error('[create-task] Error:', error);
      return `Error creating task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_task",
    description: "Create a new task. IMPORTANT: You must specify the correct category/aspect that matches the user's existing categories. Check the user's categories first and use the exact category name.",
    schema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().nullable().describe("Task description"),
      dueDate: z.string().optional().nullable().describe("Due date (ISO format)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().nullable().describe("Priority level"),
      category: z.string().describe("Category name - MUST match an existing user category exactly (e.g., 'CS 525', 'Personal', 'Health'). Check user's categories first."),
      energyRequired: z.enum(["low", "medium", "high"]).optional().nullable().describe("Energy level required"),
      estimatedDuration: z.number().optional().nullable().describe("Estimated duration in minutes"),
    }),
  }
);
