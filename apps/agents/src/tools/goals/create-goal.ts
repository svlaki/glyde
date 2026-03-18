import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const createGoalTool = tool(
  async ({ title, description, targetDate, aspect, goalType, priorityScore, energyRequirement, reviewFrequency, milestones, milestoneType, parentGoalId, keyResults, blockers, resourcesNeeded, reflectionPrompts, progress, status, timeHorizon }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

      // Convert dates from local timezone to UTC
      const targetDateUTC = targetDate && timezone ? convertToUTC(targetDate, timezone) : targetDate;

      // Convert milestone due_dates to UTC
      const convertedMilestones = milestones?.map((m: any) => ({
        ...m,
        due_date: m.due_date && timezone ? convertToUTC(m.due_date, timezone) : m.due_date,
      }));

      // Determine milestone type: if targetDate is set or milestones have dates, use 'dated'; otherwise 'ordered'
      const inferredMilestoneType = milestoneType || (
        targetDate || milestones?.some((m: any) => m.due_date) ? 'dated' : 'ordered'
      );

      const goal = await supabaseService.createGoal(userId, {
        title,
        description: description || undefined,
        targetDate: targetDateUTC || undefined,
        aspect: aspect || 'personal',
        goalType: goalType || 'SMART',
        priorityScore: priorityScore || 5,
        energyRequirement: energyRequirement || undefined,
        reviewFrequency: reviewFrequency || 'weekly',
        milestones: convertedMilestones || undefined,
        milestoneType: inferredMilestoneType,
        parentGoalId: parentGoalId || undefined,
        keyResults: keyResults || undefined,
        blockers: blockers || undefined,
        resourcesNeeded: resourcesNeeded || undefined,
        reflectionPrompts: reflectionPrompts || undefined,
        progress: progress ?? undefined,
        status: status || undefined,
        timeHorizon: timeHorizon || undefined,
      }, { source: 'agent', agentType: 'conversation' });

      if (!goal) {
        return "Failed to create goal";
      }

      // Note: Graph sync disabled to prevent Zep graph bloat
      // Individual goal creation creates too many nodes
      // Graph should only contain summary patterns, not every action
      // TODO: Implement selective sync only for significant goals or via periodic aggregation

      const targetStr = targetDate ? ` (Target: ${new Date(targetDate).toLocaleDateString()})` : '';
      const milestonesLabel = inferredMilestoneType === 'ordered' ? 'Steps' : 'Milestones';
      const milestonesStr = milestones && milestones.length > 0
        ? `\n**${milestonesLabel}:**\n${milestones.map((m: any, i: number) =>
            inferredMilestoneType === 'ordered'
              ? `${i + 1}. ${m.title}`
              : `- ${m.title}${m.due_date ? ` (due: ${new Date(m.due_date).toLocaleDateString()})` : ''}`
          ).join('\n')}`
        : '';
      return `Goal created: "${title}"${targetStr}${milestonesStr}`;
    } catch (error) {
      console.error('[create-goal] Error:', error);
      return `Error creating goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_goal",
    description: "Create a goal with milestones.",
    schema: z.object({
      title: z.string().describe("Goal title"),
      description: z.string().optional().nullable().describe("Description"),
      targetDate: z.string().optional().nullable().describe("Target date in ISO format (local timezone, no Z suffix)"),
      aspect: z.string().describe("Aspect name (must exist)"),
      goalType: z.enum(["SMART", "OKR", "milestone", "habit", "project"]).optional().nullable().describe("Goal type"),
      priorityScore: z.number().min(1).max(10).optional().nullable().describe("Priority 1-10"),
      energyRequirement: z.enum(["low", "medium", "high"]).optional().nullable().describe("Energy level"),
      reviewFrequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional().nullable().describe("Review frequency"),
      milestones: z.array(z.object({
        title: z.string().describe("Milestone title"),
        description: z.string().optional().nullable().describe("Description"),
        due_date: z.string().optional().nullable().describe("Due date ISO (for dated type)"),
        status: z.enum(["pending", "in_progress", "completed"]).optional().nullable().describe("Status"),
      })).optional().nullable().describe("Milestones for the goal"),
      milestoneType: z.enum(["dated", "ordered"]).optional().nullable().describe("'dated' (with due dates) or 'ordered' (sequential steps)"),
      parentGoalId: z.string().optional().nullable().describe("Parent goal UUID"),
      keyResults: z.array(z.object({
        description: z.string(),
        target_value: z.number(),
        current_value: z.number().optional().default(0),
        unit: z.string(),
      })).optional().nullable().describe("Key results for OKR goals"),
      blockers: z.array(z.string()).optional().nullable().describe("Known blockers"),
      resourcesNeeded: z.array(z.string()).optional().nullable().describe("Resources needed"),
      reflectionPrompts: z.record(z.any()).optional().nullable().describe("Custom reflection prompts"),
      progress: z.number().min(0).max(100).optional().nullable().describe("Initial progress 0-100"),
      status: z.enum(["active", "completed", "paused", "abandoned"]).optional().nullable().describe("Initial status"),
      timeHorizon: z.enum(["long_term", "short_term"]).optional().nullable().describe("Time horizon"),
    }),
  }
);
