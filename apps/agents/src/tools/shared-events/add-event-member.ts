import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedEventService } from "../../services/SharedEventService.js";

export const addEventMemberTool = tool(
  async ({ eventId, friendUserId, role = 'viewer' }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const sharedEventService = new SharedEventService(supabaseService.getClient());

    const result = await sharedEventService.addMember(eventId, userId, friendUserId, role);

    if (!result.success) {
      return `Failed to add member: ${result.error}`;
    }

    return `Member added to event as ${role} successfully!`;
  },
  {
    name: "add_event_member",
    description: "Add a friend to a shared event.",
    schema: z.object({
      eventId: z.string().uuid().describe("Event UUID"),
      friendUserId: z.string().uuid().describe("Friend's user UUID"),
      role: z.enum(['editor', 'viewer']).default('viewer').describe("Member role"),
    }),
  }
);
