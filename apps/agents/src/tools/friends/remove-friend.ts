import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const removeFriendTool = tool(
  async ({ friendshipId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.removeFriend(friendshipId, userId);

    if (!result.success) {
      return `Failed to remove friend: ${result.error}`;
    }

    return "Friend removed successfully.";
  },
  {
    name: "remove_friend",
    description: "Remove an existing friend. Use list_friends first to find the friendshipId.",
    schema: z.object({
      friendshipId: z.string().uuid().describe("The friendship ID of the friend to remove"),
    }),
  }
);
