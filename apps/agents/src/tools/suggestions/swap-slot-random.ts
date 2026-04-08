import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SuggestionService } from "../../services/SuggestionService.js";

export const swapSlotRandomTool = tool(
  async ({ slot_id }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) return "User ID required";

    try {
      const service = new SuggestionService();
      const updated = await service.swapRandom(userId, slot_id);

      if (!updated) return "No alternative suggestions available to swap to.";

      return `Swapped slot to: "${updated.suggestion_title}" (${updated.suggestion_type})`;
    } catch (error) {
      return `Error swapping slot: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "swap_slot_random",
    description: "Swap the current suggestion in a placement slot to a random different one from the backlog. Keeps the time fixed, only changes what activity is suggested.",
    schema: z.object({
      slot_id: z.string().uuid().describe("ID of the placement slot to swap"),
    }),
  }
);
