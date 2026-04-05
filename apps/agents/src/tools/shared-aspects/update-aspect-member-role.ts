import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedAspectService } from "../../services/SharedAspectService.js";

export const updateAspectMemberRoleTool = tool(
  async ({ aspectId, aspectName, memberUserId, newRole }, config) => {
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

    // Find the member record by user ID
    const { data: member, error: findError } = await supabaseService.getClient()
      .from('aspect_members')
      .select('id')
      .eq('aspect_id', targetAspectId)
      .eq('user_id', memberUserId)
      .maybeSingle();

    if (findError || !member) {
      return "Member not found in this aspect.";
    }

    const result = await sharedAspectService.updateMemberRole(targetAspectId, userId, member.id, newRole);

    if (!result.success) {
      return `Failed to update role: ${result.error}`;
    }

    return `Member role updated to ${newRole}.`;
  },
  {
    name: "update_aspect_member_role",
    description: "Change a member's role in a shared aspect. Only the aspect owner can change roles. Supports aspect lookup by name or direct ID.",
    schema: z.object({
      aspectId: z.string().uuid().optional().describe("Aspect UUID (optional if aspectName provided)"),
      aspectName: z.string().optional().describe("Search for aspect by name if aspectId not available"),
      memberUserId: z.string().uuid().describe("User UUID of the member to update"),
      newRole: z.enum(['member', 'viewer']).describe("New role: 'member' for full edit access, 'viewer' for read-only"),
    }),
  }
);
