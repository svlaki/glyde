import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const createTaskTool = tool(
  async ({ title, description, dueDate, priority, category, energyRequired, estimatedDuration }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

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

      // Note: Graph sync disabled to prevent Zep graph bloat
      // Individual task creation creates too many nodes
      // Graph should only contain summary patterns, not every action
      // TODO: Implement selective sync only for significant tasks or via periodic aggregation

      const dueDateStr = dueDate ? ` (Due: ${new Date(dueDate).toLocaleDateString()})` : '';
      return `✅ Task created: "${title}"${dueDateStr}`;
    } catch (error) {
      console.error('❌ [create-task] Error:', error);
      return `❌ Error creating task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_task",
    description: "Create a new task with optional deadline, priority, and category. Assign the task to an appropriate category based on its nature. Use this when the user wants to add a task, todo item, or something they need to do.",
    schema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      dueDate: z.string().optional().describe("Due date (ISO format)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Priority level"),
      category: z.string().describe("Category name for this task (e.g., 'Work', 'School', 'Health & Hygiene', 'Social', 'Fitness', 'Shopping', 'Finance'). Use existing categories when possible. Defaults to 'Personal' if not specified."),
      energyRequired: z.enum(["low", "medium", "high"]).optional().describe("Energy level required"),
      estimatedDuration: z.number().optional().describe("Estimated duration in minutes"),
    }),
  }
);