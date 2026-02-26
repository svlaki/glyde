import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const acceptFriendRequestTool = tool(
  async ({ friendshipId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.acceptFriendRequest(friendshipId, userId);

    if (!result.success) {
      return `Failed to accept friend request: ${result.error}`;
    }

    return `Friend request accepted! You're now connected.`;
  },
  {
    name: "accept_friend_request",
    description: "Accept a pending friend request. Use get_pending_friend_requests first to find the friendshipId.",
    schema: z.object({
      friendshipId: z.string().uuid().describe("The friendship ID from the pending request to accept"),
    }),
  }
);
