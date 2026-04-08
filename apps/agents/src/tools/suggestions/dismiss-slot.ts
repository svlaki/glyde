import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SuggestionService } from "../../services/SuggestionService.js";

export const dismissSlotTool = tool(
  async ({ slot_id, reason }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) return "User ID required";

    try {
      const service = new SuggestionService();
      const slot = await service.dismissSlot(userId, slot_id, reason);

      if (!slot) return "Failed to dismiss slot - slot not found or already processed.";

      return `Dismissed slot.${reason ? ` Reason: ${reason}` : ''} Feedback recorded for future improvement.`;
    } catch (error) {
      return `Error dismissing slot: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "dismiss_slot",
    description: "Dismiss a placement slot. Optionally capture a reason for why it was dismissed to improve future suggestions.",
    schema: z.object({
      slot_id: z.string().uuid().describe("ID of the placement slot to dismiss"),
      reason: z.string().optional().describe("Why the user dismissed this suggestion"),
    }),
  }
);
