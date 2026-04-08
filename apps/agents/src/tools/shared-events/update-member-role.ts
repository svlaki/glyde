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
    description: "Change a member's role on a shared event.",
    schema: z.object({
      eventId: z.string().uuid().describe("Event UUID"),
      memberId: z.string().uuid().describe("Member UUID"),
      role: z.enum(['member', 'viewer']).describe("New role: 'member' for full edit access, 'viewer' for read-only"),
    }),
  }
);
