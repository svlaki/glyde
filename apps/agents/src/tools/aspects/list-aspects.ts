import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AspectService from "../../services/AspectService.js";

export const listAspectsTool = tool(
  async ({}, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const aspects = await AspectService.getAspects(userId);

      if (aspects.length === 0) {
        return "No aspects found. Create aspects as needed when users mention new types of activities.";
      }

      const aspectsList = aspects.map(aspect =>
        `• "${aspect.name}" (${aspect.color}) - ${aspect.description || 'No description'}`
      ).join('\n');

      return `Available aspects (${aspects.length}). Use the exact name in quotes when assigning:\n${aspectsList}`;
    } catch (error) {
      console.error('[list-aspects] Error:', error);
      return `Error listing aspects: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_aspects",
    description: "List all available aspects. ALWAYS use this before creating events/tasks/goals to see what aspects exist. All aspects are universal and can be used for events, tasks, and goals.",
    schema: z.object({}),
  }
);
