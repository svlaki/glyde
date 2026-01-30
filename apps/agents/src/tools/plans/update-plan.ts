import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const updatePlanTool = tool(
  async ({ planId, title, content, horizonStart, horizonEnd, status }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      // If no planId provided, try to get the active plan
      let targetPlanId = planId;
      if (!targetPlanId) {
        const existingPlan = await supabaseService.getPlan(userId);
        if (existingPlan) {
          targetPlanId = existingPlan.id;
        } else {
          // No existing plan, create one
          const newPlan = await supabaseService.createPlan(userId, {
            title: title || 'My Life Plan',
            content: content || '',
            horizonStart: horizonStart || undefined,
            horizonEnd: horizonEnd || undefined,
            status: status || 'active',
          });
          if (!newPlan) {
            return "Failed to create new plan";
          }
          return `Plan created: "${newPlan.title}"`;
        }
      }

      const updates: any = {};
      if (title !== undefined && title !== null) updates.title = title;
      if (content !== undefined && content !== null) updates.content = content;
      if (horizonStart !== undefined && horizonStart !== null) updates.horizonStart = horizonStart;
      if (horizonEnd !== undefined && horizonEnd !== null) updates.horizonEnd = horizonEnd;
      if (status !== undefined && status !== null) updates.status = status;

      const plan = await supabaseService.updatePlan(userId, targetPlanId!, updates);

      if (!plan) {
        return "Failed to update plan";
      }

      return `Plan updated: "${plan.title}"`;
    } catch (error) {
      console.error('[update-plan] Error:', error);
      return `Error updating plan: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_plan",
    description: "Update the user's life plan. Use this to weave new goals into the plan content or update plan metadata. If no planId is provided, updates the active plan (or creates one if none exists). When adding a new goal, read the current plan first with get_plan, then update with the new content naturally integrated.",
    schema: z.object({
      planId: z.string().optional().nullable().describe("Plan ID to update. If not provided, updates the active plan."),
      title: z.string().optional().nullable().describe("New plan title"),
      content: z.string().optional().nullable().describe("New plan content (markdown). When updating, integrate new goals naturally into the existing text rather than appending. Keep the tone consistent with the user's existing plan."),
      horizonStart: z.string().optional().nullable().describe("Plan start date (ISO format)"),
      horizonEnd: z.string().optional().nullable().describe("Plan end date (ISO format)"),
      status: z.enum(["draft", "active", "archived"]).optional().nullable().describe("Plan status"),
    }),
  }
);
