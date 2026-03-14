import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AspectService from "../../services/AspectService.js";

export const createAspectTool = tool(
  async ({ name, color, description, context }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      // Check if aspect already exists
      const existing = await AspectService.getAspectByName(userId, name);
      if (existing) {
        return `Aspect "${name}" already exists with color ${existing.color}`;
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

      return `Created aspect: "${name}" (${color || '#3b82f6'})`;
    } catch (error) {
      console.error('[create-aspect] Error:', error);
      return `Error creating aspect: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_aspect",
    description: "Create a new aspect (life category).",
    schema: z.object({
      name: z.string().describe("Aspect name"),
      color: z.string().optional().nullable().describe("Hex color code"),
      description: z.string().optional().nullable().describe("Aspect description"),
      context: z.record(z.any()).optional().nullable().describe("AI context object (JSON)"),
    }),
  }
);
