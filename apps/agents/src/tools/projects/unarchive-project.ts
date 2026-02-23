import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ProjectService from "../../services/ProjectService.js";

export const unarchiveProjectTool = tool(
  async ({ project_id }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      await ProjectService.unarchiveProject(userId, project_id);
      return `Project restored from archive (ID: ${project_id}). It is now active again.`;
    } catch (error) {
      return `Error unarchiving project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "unarchive_project",
    description: "Restore an archived project back to active status. Use this when the user wants to reactivate a previously archived project.",
    schema: z.object({
      project_id: z.string().describe("UUID of the archived project to restore"),
    }),
  }
);
