import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const addFriendAspectTool = tool(
  async ({ friendshipId, aspectId }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.addFriendAspect(friendshipId, userId, aspectId);

    if (!result.success) {
      return `Failed to add aspect: ${result.error}`;
    }

    return "Aspect tagged to friendship successfully.";
  },
  {
    name: "add_friend_aspect",
    description: "Tag an aspect to a friendship. Use list_aspects to find aspect IDs and list_friends to find the friendshipId.",
    schema: z.object({
      friendshipId: z.string().uuid().describe("The friendship ID to tag the aspect to"),
      aspectId: z.string().uuid().describe("The aspect ID to tag"),
    }),
  }
);
