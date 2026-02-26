import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const sendFriendRequestTool = tool(
  async ({ email }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.sendFriendRequest(userId, email);

    if (!result.success) {
      return `Failed to send friend request: ${result.error}`;
    }

    return `Friend request sent to ${email} successfully!`;
  },
  {
    name: "send_friend_request",
    description: "Send a friend request to another user by their email address.",
    schema: z.object({
      email: z.string().email().describe("Email address of the person to send a friend request to"),
    }),
  }
);
