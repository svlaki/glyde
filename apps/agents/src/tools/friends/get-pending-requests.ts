import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const getPendingFriendRequestsTool = tool(
  async (_input, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.getPendingRequests(userId);

    if (!result.success) {
      return `Failed to fetch pending requests: ${result.error}`;
    }

    const requests = result.data || [];
    if (requests.length === 0) {
      return "You have no pending friend requests.";
    }

    const requestList = requests.map(r =>
      `- ${r.requester_display_name} (${r.requester_email}) | friendshipId: ${r.id} | sent: ${new Date(r.created_at).toLocaleDateString()}`
    ).join('\n');

    return `Pending friend requests (${requests.length}):\n${requestList}\n\nUse accept_friend_request or decline_friend_request with the friendshipId to respond.`;
  },
  {
    name: "get_pending_friend_requests",
    description: "Get pending friend requests.",
    schema: z.object({}),
  }
);
