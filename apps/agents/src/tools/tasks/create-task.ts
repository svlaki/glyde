import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const createTaskTool = tool(
  async ({ title, description, dueDate, priority, aspect, energyRequired, estimatedDuration, parentGoalId, status, contextRequired, recurringPattern, projectId }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      // Convert local time to UTC for storage
      const dueDateUTC = dueDate && timezone ? convertToUTC(dueDate, timezone) : dueDate;

      const task = await supabaseService.createTask(userId, {
        title,
        description: description || undefined,
        dueDate: dueDateUTC || undefined,
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
    description: "Create a new task.",
    schema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().nullable().describe("Description"),
      dueDate: z.string().optional().nullable().describe("Due date/time in ISO format (local timezone, no Z suffix)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().nullable().describe("Priority"),
      aspect: z.string().describe("Aspect name (must exist)"),
      energyRequired: z.enum(["low", "medium", "high"]).optional().nullable().describe("Energy level"),
      estimatedDuration: z.number().optional().nullable().describe("Duration in minutes"),
      parentGoalId: z.string().optional().nullable().describe("Parent goal UUID"),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional().nullable().describe("Initial status"),
      contextRequired: z.record(z.any()).optional().nullable().describe("Context needed (JSON)"),
      recurringPattern: z.record(z.any()).optional().nullable().describe("Recurring config (JSON)"),
      projectId: z.string().optional().nullable().describe("Project UUID"),
    }),
  }
);
