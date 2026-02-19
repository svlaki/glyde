import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createTaskTool = tool(
  async ({ title, description, dueDate, priority, aspect, energyRequired, estimatedDuration, parentGoalId, status, contextRequired, recurringPattern, projectId }, config) => {
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
        aspect: aspect || 'Personal',
        energyRequired: energyRequired || undefined,
        estimatedDuration: estimatedDuration || undefined,
        parentGoalId: parentGoalId || undefined,
        status: status || 'pending',
        contextRequired: contextRequired || undefined,
        recurringPattern: recurringPattern || undefined,
        projectId: projectId || undefined,
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
    description: "Create a new task. IMPORTANT: You must specify the correct aspect that matches the user's existing aspects. Check the user's aspects first and use the exact aspect name.",
    schema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().nullable().describe("Task description"),
      dueDate: z.string().optional().nullable().describe("Due date (ISO format)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().nullable().describe("Priority level"),
      aspect: z.string().describe("Aspect name - MUST match an existing user aspect exactly (e.g., 'CS 525', 'Personal', 'Health'). Check user's aspects first."),
      energyRequired: z.enum(["low", "medium", "high"]).optional().nullable().describe("Energy level required"),
      estimatedDuration: z.number().optional().nullable().describe("Estimated duration in minutes"),
      parentGoalId: z.string().optional().nullable().describe("ID of a parent goal to link this task to. Use list_goals to find goal IDs."),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional().nullable().describe("Initial task status. Defaults to 'pending'."),
      contextRequired: z.record(z.any()).optional().nullable().describe("Context needed for this task (e.g., tools, location, prerequisites)"),
      recurringPattern: z.record(z.any()).optional().nullable().describe("Recurring pattern config (e.g., { frequency: 'daily', interval: 1 })"),
      projectId: z.string().optional().nullable().describe("UUID of a project to link this task to. Use list_projects to find project IDs."),
    }),
  }
);
