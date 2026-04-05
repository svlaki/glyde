import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedAspectService } from "../../services/SharedAspectService.js";

export const getAspectMembersTool = tool(
  async ({ aspectId, aspectName }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const sharedAspectService = new SharedAspectService(supabaseService.getClient());

    let targetAspectId = aspectId;

    if (!targetAspectId) {
      if (!aspectName) {
        throw new Error("Either aspectId or aspectName must be provided");
      }

      const aspects = await supabaseService.getAspects(userId);
      const normalizedName = aspectName.toLowerCase().trim();
      const match = aspects.find((a: any) => a.name.toLowerCase().trim() === normalizedName);

      if (!match) {
        const available = aspects.map((a: any) => a.name).join(', ');
        throw new Error(`No aspect found matching "${aspectName}". Available aspects: ${available}`);
      }

      targetAspectId = match.id;
    }

    if (!targetAspectId) {
      throw new Error("Either aspectId or aspectName must be provided");
    }

    const result = await sharedAspectService.getAspectMembers(targetAspectId, userId);

    if (!result.success) {
      return `Failed to get members: ${result.error}`;
    }

    const members = result.data || [];
    if (members.length === 0) {
      return "This aspect has no members (it may not be shared yet).";
    }

    const memberList = members.map(m => {
      const name = m.user?.display_name || m.user?.email || m.user_id;
      return `- ${name} (${m.role}, ${m.status})`;
    }).join('\n');

    return `Aspect members (${members.length}):\n${memberList}`;
  },
  {
    name: "get_aspect_members",
    description: "List all members of a shared aspect, including their roles and invite status. Supports aspect lookup by name or direct ID.",
    schema: z.object({
      aspectId: z.string().uuid().optional().describe("Aspect UUID (optional if aspectName provided)"),
      aspectName: z.string().optional().describe("Search for aspect by name if aspectId not available"),
    }),
  }
);
