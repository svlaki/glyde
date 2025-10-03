import { tool } from "@langchain/core/tools";
import { z } from "zod";
import profileService from "../../services/ProfileService.js";

export const updateProfileTool = tool(
  async ({ field, value }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      await profileService.updateField(userId, field, value);
      return `✅ Profile updated: ${field} = ${typeof value === 'object' ? JSON.stringify(value) : value}`;
    } catch (error) {
      console.error('❌ [update-profile] Error:', error);
      return `❌ Error updating profile: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_profile",
    description: "Update a specific field in the user profile. Use this to learn and store information about the user as you interact with them. Examples: 'productivity.peakFocusHours', 'work.role', 'health.sleepSchedule.targetBedtime'",
    schema: z.object({
      field: z.string().describe("Profile field path (e.g., 'productivity.peakFocusHours', 'work.workingHours.start')"),
      value: z.any().describe("New value for the field (can be string, number, array, or object)"),
    }),
  }
);
