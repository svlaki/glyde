import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SuggestionService } from "../../services/SuggestionService.js";

export const createPlacementSlotTool = tool(
  async ({ start_time, end_time, suggestion_id, reasoning }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) return "User ID required";

    try {
      // Validate minimum 60 minute duration
      const startMs = new Date(start_time).getTime();
      const endMs = new Date(end_time).getTime();
      const durationMin = (endMs - startMs) / (1000 * 60);

      if (durationMin < 60) {
        return `REJECTED: Slot duration is ${Math.round(durationMin)} minutes. Minimum is 60 minutes. Try a longer window.`;
      }

      const service = new SuggestionService();
      const slot = await service.createSlot(userId, {
        start_time,
        end_time,
        suggestion_id,
        source_agent: 'scheduler',
        reasoning,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      if (!slot) {
        return "REJECTED: Slot overlaps with an existing event or suggestion slot. Pick a different time window that does not overlap.";
      }

      const start = new Date(slot.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const end = new Date(slot.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      return `Created placement slot: ${start} - ${end} (suggestion: ${suggestion_id}). Reason: ${reasoning || 'none'}`;
    } catch (error) {
      return `Error creating slot: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_placement_slot",
    description: "Place an action suggestion on the calendar as a dotted suggestion slot. The user will see it and can confirm, dismiss, or swap it. Returns REJECTED if the slot overlaps with an existing event or slot -- choose a different time if this happens.",
    schema: z.object({
      start_time: z.string().describe("ISO start time for the slot"),
      end_time: z.string().describe("ISO end time for the slot"),
      suggestion_id: z.string().uuid().describe("ID of the action suggestion to place"),
      reasoning: z.string().optional().describe("Why this time was chosen (shown to user)"),
    }),
  }
);
