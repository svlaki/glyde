import { tool } from "@langchain/core/tools";
import { z } from "zod";
import profileService from "../../services/ProfileService.js";

export const getProfileTool = tool(
  async ({ section }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      if (section) {
        const sectionData = await profileService.getProfileSection(userId, section as any);
        if (!sectionData) {
          return `No data found for section: ${section}`;
        }
        return `Profile section "${section}":\n${JSON.stringify(sectionData, null, 2)}`;
      } else {
        const profile = await profileService.getProfile(userId);
        if (!profile) {
          return "Profile not found";
        }

        const summary = await profileService.getProfileSummary(userId);
        const completeness = await profileService.getProfileCompleteness(userId);

        return `Profile Summary (${completeness}% complete):\n${summary}`;
      }
    } catch (error) {
      console.error('[get-profile] Error:', error);
      return `Error getting profile: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "get_profile",
    description: "Get user profile information.",
    schema: z.object({
      section: z.enum(["values", "preferences", "work_patterns", "personality_traits", "context_data", "habits"]).optional().nullable().describe("Profile section (JSON column name)"),
    }),
  }
);
