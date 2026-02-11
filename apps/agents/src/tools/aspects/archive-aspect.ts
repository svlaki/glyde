import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AspectService from "../../services/AspectService.js";

export const archiveAspectTool = tool(
  async ({ name }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const existing = await AspectService.getAspectByName(userId, name);
      if (!existing) {
        return `Aspect "${name}" not found`;
      }

      await AspectService.archiveAspect(userId, existing.id);

      return `Archived aspect "${name}". It will no longer appear in your active aspects but can be restored later.`;
    } catch (error) {
      console.error('[archive-aspect] Error:', error);
      return `Error archiving aspect: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "archive_aspect",
    description: "Archive an aspect instead of deleting it. The aspect will be hidden from active use but can be restored later. Use this when the user wants to remove an aspect without permanently deleting it.",
    schema: z.object({
      name: z.string().describe("Aspect name to archive"),
    }),
  }
);
