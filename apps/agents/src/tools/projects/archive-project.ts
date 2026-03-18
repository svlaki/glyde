import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ProjectService from "../../services/ProjectService.js";

export const archiveProjectTool = tool(
  async ({ project_id }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      await ProjectService.archiveProject(userId, project_id);
      return `Project archived successfully (ID: ${project_id})`;
    } catch (error) {
      return `Error archiving project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "archive_project",
    description: "Archive a project (hidden but restorable).",
    schema: z.object({
      project_id: z.string().describe("Project UUID"),
    }),
  }
);
