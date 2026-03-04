import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const updateGoalTool = tool(
  async ({ goalId, title, description, targetDate, status, progress, aspect, priorityScore }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

      // Get original goal to compare changes
      const goals = await supabaseService.getGoals(userId);
      const originalGoal = goals.find((g: any) => g.id === goalId);

      const updates: any = {};

      // Only include fields that are actually provided with non-empty values
      if (title !== undefined && title !== null && title.trim() !== '') updates.title = title;
      if (description !== undefined && description !== null && description.trim() !== '') updates.description = description;
      if (targetDate !== undefined && targetDate !== null && targetDate.trim() !== '') updates.targetDate = targetDate;
      if (status !== undefined && status !== null) updates.status = status;
      if (progress !== undefined && progress !== null) updates.progress = progress;
      if (aspect !== undefined && aspect !== null && aspect.trim() !== '') updates.aspect = aspect;
      if (priorityScore !== undefined && priorityScore !== null) updates.priorityScore = priorityScore;
      const goal = await supabaseService.updateGoal(userId, goalId, updates, { source: 'agent', agentType: 'conversation' });

      if (!goal) {
        return "Failed to update goal";
      }

      // Update in Zep knowledge graph asynchronously
      const updateGraph = async () => {
        try {
          await zepGraphService.addGoal(userId, {
            goalId: goal.id,
            title: goal.title,
            goal_type: goal.goal_type || 'SMART',
            status: goal.status || 'active',
            progress_percentage: progress !== undefined ? progress : (goal.progress || 0),
            deadline: goal.target_date,
            time_invested_minutes: 0, // Could be enhanced to track actual time
          });
          console.log(`[update-goal] Goal update added to knowledge graph: ${goal.title}`);
        } catch (error) {
          console.error('[update-goal] Failed to update knowledge graph (non-critical):', error);
        }
      };
      updateGraph(); // Fire and forget

      // Build detailed change description
      const changes: string[] = [];
      const goalTitle = title || goal.title || originalGoal?.title || 'Goal';

      if (title && originalGoal?.title !== title) {
        changes.push(`renamed to "${title}"`);
      }
      if (progress !== undefined) {
        changes.push(`progress updated to ${progress}%`);
      }
      if (status !== undefined && originalGoal?.status !== status) {
        if (status === 'completed') {
          changes.push('marked as complete');
        } else {
          changes.push(`status changed to ${status}`);
        }
      }
      if (targetDate !== undefined) {
        if (targetDate === null) {
          changes.push('target date removed');
        } else {
          const newDate = new Date(targetDate);
          const dateStr = newDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          changes.push(`target date changed to ${dateStr}`);
        }
      }
      if (aspect !== undefined && originalGoal?.aspect !== aspect) {
        changes.push(`aspect changed to "${aspect}"`);
      }
      const changeDescription = changes.length > 0 ? ` - ${changes.join(', ')}` : '';

      return `GOAL: "${goalTitle}" has been updated${changeDescription}`;
    } catch (error) {
      console.error('[update-goal] Error:', error);
      return `Error updating goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_goal",
    description: "Update an existing goal. Use this to modify goal details, update progress, change status, or reschedule target dates.",
    schema: z.object({
      goalId: z.string().describe("Goal ID to update"),
      title: z.string().optional().nullable().describe("New goal title"),
      description: z.string().optional().nullable().describe("New goal description"),
      targetDate: z.string().optional().nullable().describe("New target date (ISO format)"),
      status: z.enum(["active", "completed", "paused", "abandoned"]).optional().nullable().describe("New status"),
      progress: z.number().min(0).max(100).optional().nullable().describe("Progress percentage (0-100)"),
      aspect: z.string().optional().nullable().describe("New aspect name"),
      priorityScore: z.number().min(1).max(10).optional().nullable().describe("New priority score (1-10)"),
    }),
  }
);
