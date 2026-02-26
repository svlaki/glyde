import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedEventService } from "../../services/SharedEventService.js";

export const updateMemberRoleTool = tool(
  async ({ eventId, memberId, role }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const sharedEventService = new SharedEventService(supabaseService.getClient());

    const result = await sharedEventService.updateMemberRole(eventId, userId, memberId, role);

    if (!result.success) {
      return `Failed to update member role: ${result.error}`;
    }

    return `Member role updated to ${role} successfully.`;
  },
  {
    name: "update_member_role",
    description: "Change a member's role on a shared event. Only the event owner can change roles. Use get_event_members to find the memberId.",
    schema: z.object({
      eventId: z.string().uuid().describe("The event ID"),
      memberId: z.string().uuid().describe("The member record ID to update"),
      role: z.enum(['editor', 'viewer']).describe("The new role for the member"),
    }),
  }
);
