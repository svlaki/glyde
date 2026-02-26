import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const declineFriendRequestTool = tool(
  async ({ friendshipId, block = false }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.declineFriendRequest(friendshipId, userId, block);

    if (!result.success) {
      return `Failed to decline friend request: ${result.error}`;
    }

    return block
      ? "Friend request declined and user blocked."
      : "Friend request declined.";
  },
  {
    name: "decline_friend_request",
    description: "Decline a pending friend request. Optionally block the user to prevent future requests.",
    schema: z.object({
      friendshipId: z.string().uuid().describe("The friendship ID of the request to decline"),
      block: z.boolean().default(false).describe("Set to true to also block the user from sending future requests"),
    }),
  }
);
