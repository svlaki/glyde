import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AspectService from "../../services/AspectService.js";

export const deleteAspectTool = tool(
  async ({ name }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      // Find aspect by name
      const existing = await AspectService.getAspectByName(userId, name);
      if (!existing) {
        return `Aspect "${name}" not found`;
      }

      await AspectService.deleteAspect(userId, existing.id);

      return `Deleted aspect "${name}"`;
    } catch (error) {
      console.error('[delete-aspect] Error:', error);
      return `Error deleting aspect: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_aspect",
    description: "Delete an aspect permanently.",
    schema: z.object({
      name: z.string().describe("Aspect name to delete"),
    }),
  }
);
