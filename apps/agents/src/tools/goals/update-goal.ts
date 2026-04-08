import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const updateGoalTool = tool(
  async ({ goalId, title, description, targetDate, status, progress, aspect, priorityScore, milestones }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      // Get original goal to compare changes
      const goals = await supabaseService.getGoals(userId);
      const originalGoal = goals.find((g: any) => g.id === goalId);

      // Convert dates from local timezone to UTC
      const targetDateUTC = targetDate && timezone ? convertToUTC(targetDate, timezone) : targetDate;

      // Convert milestone due_dates to UTC
      const convertedMilestones = milestones?.map((m: any) => ({
        ...m,
        due_date: m.due_date && timezone ? convertToUTC(m.due_date, timezone) : m.due_date,
      }));

      const updates: any = {};

      // Only include fields that are actually provided with non-empty values
      if (title !== undefined && title !== null && title.trim() !== '') updates.title = title;
      if (description !== undefined && description !== null && description.trim() !== '') updates.description = description;
      if (targetDateUTC !== undefined && targetDateUTC !== null && targetDateUTC.trim() !== '') updates.targetDate = targetDateUTC;
      if (status !== undefined && status !== null) updates.status = status;
      if (progress !== undefined && progress !== null) updates.progress = progress;
      if (aspect !== undefined && aspect !== null && aspect.trim() !== '') updates.aspect = aspect;
      if (priorityScore !== undefined && priorityScore !== null) updates.priorityScore = priorityScore;
      if (convertedMilestones !== undefined && convertedMilestones !== null) updates.milestones = convertedMilestones;

      const goal = await supabaseService.updateGoal(userId, goalId, updates, { source: 'agent', agentType: 'conversation' });

      if (!goal) {
        return "Failed to update goal";
      }

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
      if (milestones !== undefined && milestones !== null) {
        changes.push(`milestones updated (${milestones.length} total)`);
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
    description: "Update a goal by ID.",
    schema: z.object({
      goalId: z.string().describe("Goal UUID"),
      title: z.string().optional().nullable().describe("New title"),
      description: z.string().optional().nullable().describe("New description"),
      targetDate: z.string().optional().nullable().describe("New target date in ISO format (local timezone, no Z suffix)"),
      status: z.enum(["active", "completed", "paused", "abandoned"]).optional().nullable().describe("New status"),
      progress: z.number().min(0).max(100).optional().nullable().describe("Progress 0-100"),
      aspect: z.string().optional().nullable().describe("New aspect"),
      priorityScore: z.number().min(1).max(10).optional().nullable().describe("Priority 1-10"),
      milestones: z.array(z.object({
        title: z.string().describe("Title"),
        description: z.string().optional().nullable().describe("Description"),
        due_date: z.string().optional().nullable().describe("Due date ISO"),
        status: z.enum(["pending", "in_progress", "completed"]).optional().nullable().describe("Status"),
      })).optional().nullable().describe("Replaces all milestones"),
    }),
  }
);
