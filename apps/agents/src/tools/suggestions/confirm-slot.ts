import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SuggestionService } from "../../services/SuggestionService.js";

export const confirmSlotTool = tool(
  async ({ slot_id }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) return "User ID required";

    try {
      const service = new SuggestionService();
      const result = await service.confirmSlot(userId, slot_id);

      if (!result) return "Failed to confirm slot - slot not found or already processed.";

      return `Confirmed slot and created event (event_id: ${result.event_id}). The suggestion is now a real calendar event.`;
    } catch (error) {
      return `Error confirming slot: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "confirm_slot",
    description: "Confirm a placement slot, converting it into a real calendar event. The suggestion is marked as completed.",
    schema: z.object({
      slot_id: z.string().uuid().describe("ID of the placement slot to confirm"),
    }),
  }
);
