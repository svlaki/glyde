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
    description: "Add a friend to a shared event. Only friends can be added. Use list_friends to find the friend's userId and list_events/search_events to find the eventId.",
    schema: z.object({
      eventId: z.string().uuid().describe("The event ID to add a member to"),
      friendUserId: z.string().uuid().describe("The friend's user ID (from list_friends) to add to the event"),
      role: z.enum(['editor', 'viewer']).default('viewer').describe("Role for the new member. 'editor' can modify the event, 'viewer' can only see it."),
    }),
  }
);
