import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AspectService from "../../services/AspectService.js";

export const updateAspectTool = tool(
  async ({ name, newName, color, description, context }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      // Find aspect by name
      const existing = await AspectService.getAspectByName(userId, name);
      if (!existing) {
        return `Aspect "${name}" not found. Use list_aspects to see available aspects.`;
      }

      // Prepare updates
      const updates: any = {};
      if (newName) updates.name = newName;
      if (color) updates.color = color;
      if (description !== undefined) updates.description = description;
      if (context !== undefined) updates.context = context;

      const updated = await AspectService.updateAspect(userId, existing.id, updates);

      if (!updated) {
        return "Failed to update aspect";
      }

      return `Updated aspect "${name}"${newName ? ` → "${newName}"` : ''}`;
    } catch (error) {
      console.error('[update-aspect] Error:', error);
      return `Error updating aspect: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_aspect",
    description: "Update an aspect's properties.",
    schema: z.object({
      name: z.string().describe("Current aspect name"),
      newName: z.string().optional().nullable().describe("New name"),
      color: z.string().optional().nullable().describe("New hex color code"),
      description: z.string().optional().nullable().describe("New description"),
      context: z.record(z.any()).optional().nullable().describe("Updated AI context (JSON)"),
    }),
  }
);
