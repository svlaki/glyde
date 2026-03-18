import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedEventService } from "../../services/SharedEventService.js";

export const getEventMembersTool = tool(
  async ({ eventId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const sharedEventService = new SharedEventService(supabaseService.getClient());

    const result = await sharedEventService.getEventMembers(eventId, userId);

    if (!result.success) {
      return `Failed to fetch members: ${result.error}`;
    }

    const members = result.data || [];
    if (members.length === 0) {
      return "This event has no shared members.";
    }

    const memberList = members.map(m => {
      const name = m.user?.display_name || m.user?.email || 'Unknown';
      return `- ${name} (${m.role}) | memberId: ${m.id}`;
    }).join('\n');

    return `Event members (${members.length}):\n${memberList}`;
  },
  {
    name: "get_event_members",
    description: "List members of a shared event.",
    schema: z.object({
      eventId: z.string().uuid().describe("Event UUID"),
    }),
  }
);
