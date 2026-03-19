import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AspectService from "../../services/AspectService.js";

/**
 * Upsert helper: if aspect exists, enrich it with any new description/context/color.
 * Handles both the "already existed" and "race-condition duplicate" cases.
 */
async function enrichExistingAspect(
  userId: string,
  existing: any,
  description?: string | null,
  context?: Record<string, any> | null,
  color?: string | null
): Promise<string> {
  const updates: Record<string, any> = {};

  if (description) {
    if (!existing.description) {
      updates.description = description;
    } else if (!existing.description.includes(description.slice(0, 50))) {
      updates.description = existing.description + '\n' + description;
    }
  }
  if (context) {
    updates.context = { ...(existing.context || {}), ...context };
  }
  // Only override the auto-created gray color with a real color
  if (color && color !== '#6B7280' && existing.color === '#6B7280') {
    updates.color = color;
  }

  if (Object.keys(updates).length > 0) {
    await AspectService.updateAspect(userId, existing.id, updates);
    return `Updated aspect "${existing.name}" with new details`;
  }
  return `Aspect "${existing.name}" already exists with color ${existing.color}`;
}

export const createAspectTool = tool(
  async ({ name, color, description, context }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      // Check if aspect already exists — enrich it with any new info
      const existing = await AspectService.getAspectByName(userId, name);
      if (existing) {
        return await enrichExistingAspect(userId, existing, description, context, color);
      }

      const aspect = await AspectService.createAspect(userId, {
        name,
        color: color || '#3b82f6',
        description: description || undefined,
        context: context || undefined,
      });

      if (!aspect) {
        return "Failed to create aspect";
      }

      return `Created aspect: "${name}" (${color || '#3b82f6'})${description ? ' with description' : ''}`;
    } catch (error: any) {
      // Race condition: parallel tool (e.g. create_recurring_event) auto-created the aspect
      // between our check and our create. Retry lookup and enrich with description/context.
      if (error?.message?.includes('duplicate') || error?.message?.includes('unique constraint')) {
        const retried = await AspectService.getAspectByName(userId, name);
        if (retried) {
          return await enrichExistingAspect(userId, retried, description, context, color);
        }
      }
      console.error('[create-aspect] Error:', error);
      return `Error creating aspect: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_aspect",
    description: "Create a new aspect (life category). When creating from a document (syllabus, course page, agenda, etc.), always include a rich description with all relevant details (instructor, grading, policies, key dates, resources).",
    schema: z.object({
      name: z.string().describe("Aspect name"),
      color: z.string().optional().nullable().describe("Hex color code"),
      description: z.string().optional().nullable().describe("Aspect description — include all useful reference info"),
      context: z.record(z.any()).optional().nullable().describe("AI context object (JSON)"),
    }),
  }
);
