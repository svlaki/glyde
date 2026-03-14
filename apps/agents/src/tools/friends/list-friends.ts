import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { FriendshipService } from "../../services/FriendshipService.js";

export const listFriendsTool = tool(
  async (_input, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const friendshipService = new FriendshipService(supabaseService.getClient());

    const result = await friendshipService.getFriends(userId);

    if (!result.success) {
      return `Failed to fetch friends: ${result.error}`;
    }

    const friends = result.data || [];
    if (friends.length === 0) {
      return "You don't have any friends added yet.";
    }

    const friendList = friends.map(f => {
      const aspects = f.aspects?.length > 0
        ? ` [${f.aspects.map(a => a.name).join(', ')}]`
        : '';
      const notes = f.notes ? ` | Notes: ${f.notes}` : '';
      return `- ${f.friend_display_name} (${f.friend_email}) (friendshipId: ${f.friendship_id}, userId: ${f.friend_id})${aspects}${notes}`;
    }).join('\n');

    return `Friends (${friends.length}):\n${friendList}`;
  },
  {
    name: "list_friends",
    description: "List all friends.",
    schema: z.object({}),
  }
);
