import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const createGoalTool = tool(
  async ({ title, description, targetDate, aspect, goalType, priorityScore, energyRequirement, reviewFrequency, parentGoalId, keyResults, blockers, resourcesNeeded, reflectionPrompts, progress, status, timeHorizon }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

      const goal = await supabaseService.createGoal(userId, {
        title,
        description: description || undefined,
        targetDate: targetDate || undefined,
        aspect: aspect || 'personal',
        goalType: goalType || 'SMART',
        priorityScore: priorityScore || 5,
        energyRequirement: energyRequirement || undefined,
        reviewFrequency: reviewFrequency || 'weekly',
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
      return `Goal created: "${title}"${targetStr}`;
    } catch (error) {
      console.error('[create-goal] Error:', error);
      return `Error creating goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_goal",
    description: "Create a new goal. Use this when the user wants to set a long-term objective, ambition, or something they want to achieve. IMPORTANT: Every goal MUST have an aspect (Health, Work, Finance, Personal, or Education).",
    schema: z.object({
      title: z.string().describe("Goal title"),
      description: z.string().optional().nullable().describe("Goal description"),
      targetDate: z.string().optional().nullable().describe("Target completion date (ISO format)"),
      aspect: z.string().describe("REQUIRED: Aspect name for the goal. Must be one of: 'Health' (fitness, wellness), 'Work' (career, professional), 'Finance' (money, savings), 'Personal' (relationships, hobbies), or 'Education' (learning, skills). Every goal MUST have an aspect."),
      goalType: z.enum(["SMART", "OKR", "habit", "project"]).optional().nullable().describe("Type of goal"),
      priorityScore: z.number().min(1).max(10).optional().nullable().describe("Priority score (1-10)"),
      energyRequirement: z.enum(["low", "medium", "high"]).optional().nullable().describe("Energy requirement"),
      reviewFrequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional().nullable().describe("How often to review"),
      parentGoalId: z.string().optional().nullable().describe("ID of a parent goal to make this a sub-goal. Use list_goals to find goal IDs."),
      keyResults: z.array(z.object({
        description: z.string(),
        target_value: z.number(),
        current_value: z.number().optional().default(0),
        unit: z.string(),
      })).optional().nullable().describe("Key results for OKR-type goals (e.g., [{description: 'Increase revenue', target_value: 100000, current_value: 0, unit: 'USD'}])"),
      blockers: z.array(z.string()).optional().nullable().describe("Known blockers or obstacles for this goal"),
      resourcesNeeded: z.array(z.string()).optional().nullable().describe("Resources needed to achieve this goal"),
      reflectionPrompts: z.record(z.any()).optional().nullable().describe("Custom reflection prompts for check-ins"),
      progress: z.number().min(0).max(100).optional().nullable().describe("Initial progress percentage (0-100). Defaults to 0."),
      status: z.enum(["active", "completed", "paused", "abandoned"]).optional().nullable().describe("Initial goal status. Defaults to 'active'."),
      timeHorizon: z.enum(["long_term", "short_term"]).optional().nullable().describe("Time horizon: 'short_term' for weeks/months, 'long_term' for years. Defaults to 'short_term'."),
    }),
  }
);
