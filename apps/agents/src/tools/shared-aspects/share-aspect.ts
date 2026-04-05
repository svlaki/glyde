import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedAspectService } from "../../services/SharedAspectService.js";

export const shareAspectTool = tool(
  async ({ aspectId, aspectName, friendUserId, role = 'viewer' }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const sharedAspectService = new SharedAspectService(supabaseService.getClient());

    let targetAspectId = aspectId;

    // If no aspectId, resolve via name search
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

    // First, ensure the aspect is set to shared visibility
    const { data: aspect, error: aspectError } = await supabaseService.getClient()
      .from('aspects')
      .select('visibility, user_id')
      .eq('id', targetAspectId)
      .eq('user_id', userId)
      .single();

    if (aspectError || !aspect) {
      throw new Error("Aspect not found or you don't own it");
    }

    // Auto-upgrade to shared visibility if still private
    if (aspect.visibility !== 'shared') {
      const { error: updateError } = await supabaseService.getClient()
        .from('aspects')
        .update({ visibility: 'shared' })
        .eq('id', targetAspectId);

      if (updateError) {
        throw new Error("Failed to update aspect visibility");
      }
    }

    // Ensure owner is in aspect_members
    const { data: ownerMember } = await supabaseService.getClient()
      .from('aspect_members')
      .select('id')
      .eq('aspect_id', targetAspectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!ownerMember) {
      await supabaseService.getClient()
        .from('aspect_members')
        .insert({
          aspect_id: targetAspectId,
          user_id: userId,
          role: 'owner',
          status: 'accepted'
        });
    }

    // Add the friend as a member
    const result = await sharedAspectService.addMember(targetAspectId, userId, friendUserId, role);

    if (!result.success) {
      return `Failed to share aspect: ${result.error}`;
    }

    return `Aspect invite sent! ${role === 'member' ? 'They will have full edit access to all events/tasks/goals under this aspect once they accept.' : 'They will have view-only access to all events/tasks/goals under this aspect once they accept.'}`;
  },
  {
    name: "share_aspect",
    description: "Share an aspect (life category) with a friend. This makes ALL events, tasks, and goals under this aspect visible to them. They must accept the invite first. Supports aspect lookup by name or direct ID.",
    schema: z.object({
      aspectId: z.string().uuid().optional().describe("Aspect UUID (optional if aspectName provided)"),
      aspectName: z.string().optional().describe("Search for aspect by name if aspectId not available"),
      friendUserId: z.string().uuid().describe("Friend's user UUID"),
      role: z.enum(['member', 'viewer']).default('viewer').describe("Member role: 'member' for full edit access, 'viewer' for read-only"),
    }),
  }
);
