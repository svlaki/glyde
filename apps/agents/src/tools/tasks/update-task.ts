import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const updateTaskTool = tool(
  async ({ taskId, searchQuery, title, description, dueDate, priority, status, aspect, energyRequired, estimatedDuration }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    let targetTaskId = taskId;

    // If no taskId provided, search for the task
    if (!targetTaskId) {
      if (!searchQuery) {
        return "Either taskId or searchQuery must be provided";
      }

      console.log('🔍 [UPDATE-TASK TOOL] Searching for task to update:', searchQuery);

      try {
        const supabaseService = getSupabaseService();
        const tasks = await supabaseService.getTasks(userId);

        // Normalize search query - remove common words and split
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word =>
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at', 'my', 'move', 'change', 'update', 'set', 'deadline'].includes(word)
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
        matchingTasks.sort((a: any, b: any) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();

          const aMatches = queryWords.filter(word => aTitle.includes(word)).length;
          const bMatches = queryWords.filter(word => bTitle.includes(word)).length;

          return bMatches - aMatches;
        });

        if (matchingTasks.length > 0) {
          targetTaskId = matchingTasks[0].id;
          console.log('[UPDATE-TASK TOOL] Found task to update:', matchingTasks[0].title);
        } else {
          return `No task found matching: "${searchQuery}". Available tasks: ${tasks.map((t: any) => t.title).join(', ')}`;
        }
      } catch (error) {
        console.error('[UPDATE-TASK TOOL] Search error:', error);
        return `Failed to find task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    if (!targetTaskId) {
      return "Failed to identify task to update";
    }

    try {
      const supabaseService = getSupabaseService();

      // Get the original task to compare changes
      const tasks = await supabaseService.getTasks(userId);
      const originalTask = tasks.find((t: any) => t.id === targetTaskId);

      if (!originalTask) {
        return `Task not found with ID: ${targetTaskId}`;
      }

      const updates: any = {};

      // Only include fields that were explicitly provided with real values.
      // The LLM often sends null for fields it doesn't intend to change.
      if (title != null && title.trim() !== '') updates.title = title;
      if (description != null) updates.description = description;
      if (dueDate !== undefined) updates.dueDate = dueDate; // null is valid here (clears due date)
      if (priority != null) updates.priority = priority;
      if (status != null) updates.status = status;
      if (aspect != null) updates.aspect = aspect;
      if (energyRequired != null) updates.energyRequired = energyRequired;
      if (estimatedDuration != null) updates.estimatedDuration = estimatedDuration;

      const task = await supabaseService.updateTask(userId, targetTaskId, updates, { source: 'agent', agentType: 'conversation' });

      if (!task) {
        return "Failed to update task";
      }

      // Build detailed change description
      const changes: string[] = [];

      if (title !== undefined && originalTask?.title !== title) {
        changes.push(`renamed to "${title}"`);
      }
      if (dueDate !== undefined) {
        if (dueDate === null) {
          changes.push('due date removed');
        } else {
          const newDueDate = new Date(dueDate);
          const dateStr = newDueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          const timeStr = newDueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          changes.push(`due date changed to ${dateStr} at ${timeStr}`);
        }
      }
      if (priority !== undefined && originalTask?.priority !== priority) {
        changes.push(`priority changed to ${priority}`);
      }
      if (status !== undefined && originalTask?.status !== status) {
        if (status === 'completed') {
          changes.push('marked as complete');
        } else {
          changes.push(`status changed to ${status}`);
        }
      }
      if (aspect !== undefined && originalTask?.aspect !== aspect) {
        changes.push(`aspect changed to "${aspect}"`);
      }

      const taskTitle = task.title || originalTask?.title || 'Task';
      const changeDescription = changes.length > 0 ? ` - ${changes.join(', ')}` : '';

      return `TASK: "${taskTitle}" has been updated${changeDescription}`;
    } catch (error) {
      console.error('[update-task] Error:', error);
      return `Error updating task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_task",
    description: "Update an existing task by searching for it with a text query. Finds the task using fuzzy matching on title and description. Use this to modify task details, change priority, reschedule, or update status.",
    schema: z.object({
      taskId: z.string().optional().nullable().describe("Task ID to update (optional - rarely used, prefer searchQuery)"),
      searchQuery: z.string().optional().nullable().describe("Search query to find and update the task. Examples: 'cs 221', 'grocery shopping', 'workout'. The tool will fuzzy match against task titles and descriptions."),
      title: z.string().nullable().optional().describe("New task title"),
      description: z.string().nullable().optional().describe("New task description"),
      dueDate: z.string().nullable().optional().describe("New due date (ISO format)"),
      priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional().describe("New priority level"),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).nullable().optional().describe("New status"),
      aspect: z.string().nullable().optional().describe("New aspect name"),
      energyRequired: z.enum(["low", "medium", "high"]).nullable().optional().describe("Energy level required"),
      estimatedDuration: z.number().nullable().optional().describe("Estimated duration in minutes"),
    }),
  }
);
