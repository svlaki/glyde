import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createTaskTool = tool(
  async ({ title, description, dueDate, priority, category, energyRequired, estimatedDuration }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const task = await supabaseService.createTask(userId, {
        title,
        description: description || undefined,
        dueDate: dueDate || undefined,
        priority: priority || 'medium',
        category: category || 'personal',
        energyRequired: energyRequired || undefined,
        estimatedDuration: estimatedDuration || undefined,
      });

      if (!task) {
        return "❌ Failed to create task";
      }

      const dueDateStr = dueDate ? ` (Due: ${new Date(dueDate).toLocaleDateString()})` : '';
      return `✅ Task created: "${title}"${dueDateStr}`;
    } catch (error) {
      console.error('❌ [create-task] Error:', error);
      return `❌ Error creating task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_task",
    description: "Create a new task with optional deadline, priority, and category. Use this when the user wants to add a task, todo item, or something they need to do.",
    schema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      dueDate: z.string().optional().describe("Due date (ISO format)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Priority level"),
      category: z.string().optional().describe("Category name (e.g., 'Work', 'Personal', 'Health')"),
      energyRequired: z.enum(["low", "medium", "high"]).optional().describe("Energy level required"),
      estimatedDuration: z.number().optional().describe("Estimated duration in minutes"),
    }),
  }
);