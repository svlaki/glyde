import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const removeFriendAspectTool = tool(
  async ({ friendshipId, aspectId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.removeFriendAspect(friendshipId, userId, aspectId);

    if (!result.success) {
      return `Failed to remove aspect: ${result.error}`;
    }

    return "Aspect removed from friendship successfully.";
  },
  {
    name: "remove_friend_aspect",
    description: "Remove an aspect tag from a friendship.",
    schema: z.object({
      friendshipId: z.string().uuid().describe("The friendship ID to remove the aspect from"),
      aspectId: z.string().uuid().describe("The aspect ID to remove"),
    }),
  }
);
