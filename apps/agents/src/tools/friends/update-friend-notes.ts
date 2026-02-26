import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const updateFriendNotesTool = tool(
  async ({ friendshipId, notes }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.updateFriendNotes(friendshipId, userId, notes);

    if (!result.success) {
      return `Failed to update notes: ${result.error}`;
    }

    return "Friend notes updated successfully.";
  },
  {
    name: "update_friend_notes",
    description: "Update the notes on a friendship. Useful for saving context about a friend.",
    schema: z.object({
      friendshipId: z.string().uuid().describe("The friendship ID to update notes for"),
      notes: z.string().describe("The notes to save on this friendship"),
    }),
  }
);
