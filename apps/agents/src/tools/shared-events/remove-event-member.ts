import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedEventService } from "../../services/SharedEventService.js";

export const removeEventMemberTool = tool(
  async ({ eventId, memberId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const sharedEventService = new SharedEventService(supabaseService.getClient());

    const result = await sharedEventService.removeMember(eventId, userId, memberId);

    if (!result.success) {
      return `Failed to remove member: ${result.error}`;
    }

    return "Member removed from event successfully.";
  },
  {
    name: "remove_event_member",
    description: "Remove a member from a shared event. Only the event owner can remove members. Use get_event_members to find the memberId.",
    schema: z.object({
      eventId: z.string().uuid().describe("The event ID to remove a member from"),
      memberId: z.string().uuid().describe("The member record ID (from get_event_members) to remove"),
    }),
  }
);
