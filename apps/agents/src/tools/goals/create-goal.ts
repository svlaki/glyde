import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";

export const createGoalTool = tool(
  async ({ title, description, targetDate, category, goalType, priorityScore, energyRequirement, reviewFrequency, milestones }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const zepGraphService = new ZepGraphService();

      const goal = await supabaseService.createGoal(userId, {
        title,
        description: description || undefined,
        targetDate: targetDate || undefined,
        category: category || 'personal',
        goalType: goalType || 'SMART',
        priorityScore: priorityScore || 5,
        energyRequirement: energyRequirement || undefined,
        reviewFrequency: reviewFrequency || 'weekly',
        milestones: milestones || undefined,
      }, { source: 'agent', agentType: 'conversation' });

      if (!goal) {
        return "❌ Failed to create goal";
      }

      // Note: Graph sync disabled to prevent Zep graph bloat
      // Individual goal creation creates too many nodes
      // Graph should only contain summary patterns, not every action
      // TODO: Implement selective sync only for significant goals or via periodic aggregation

      const targetStr = targetDate ? ` (Target: ${new Date(targetDate).toLocaleDateString()})` : '';
      const milestonesStr = milestones && milestones.length > 0
        ? `\n**Milestones:**\n${milestones.map((m: any) => `- ${m.title}${m.due_date ? ` (due: ${new Date(m.due_date).toLocaleDateString()})` : ''}`).join('\n')}`
        : '';
      return `✅ Goal created: "${title}"${targetStr}${milestonesStr}`;
    } catch (error) {
      console.error('❌ [create-goal] Error:', error);
      return `❌ Error creating goal: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_goal",
    description: "Create a new goal. Use this when the user wants to set a long-term objective, ambition, or something they want to achieve. IMPORTANT: Every goal MUST have a category (Health, Work, Finance, Personal, or Education) - this is required for the timeline to display properly.",
    schema: z.object({
      title: z.string().describe("Goal title"),
      description: z.string().optional().nullable().describe("Goal description"),
      targetDate: z.string().optional().nullable().describe("Target completion date (ISO format)"),
      category: z.string().describe("REQUIRED: Category name for the goal. Must be one of: 'Health' (fitness, wellness), 'Work' (career, professional), 'Finance' (money, savings), 'Personal' (relationships, hobbies), or 'Education' (learning, skills). Every goal MUST have a category."),
      goalType: z.enum(["SMART", "OKR", "milestone", "habit", "project"]).optional().nullable().describe("Type of goal"),
      priorityScore: z.number().min(1).max(10).optional().nullable().describe("Priority score (1-10)"),
      energyRequirement: z.enum(["low", "medium", "high"]).optional().nullable().describe("Energy requirement"),
      reviewFrequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).optional().nullable().describe("How often to review"),
      milestones: z.array(z.object({
        title: z.string().describe("Milestone title"),
        description: z.string().optional().nullable().describe("Milestone description"),
        due_date: z.string().optional().nullable().describe("Target date for milestone (ISO format)"),
        status: z.enum(["pending", "in_progress", "completed"]).optional().nullable().describe("Milestone status"),
      })).optional().nullable().describe("List of milestones to track progress toward the goal. Generate sensible milestones based on goal type: habit goals get time-based milestones (1 week, 1 month, 3 months), achievement goals get step-based milestones (e.g., become a doctor: undergrad, MCAT, med school, residency), skill goals get proficiency milestones, project goals get phase milestones."),
    }),
  }
);
