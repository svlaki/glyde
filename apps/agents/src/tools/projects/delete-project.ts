import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ProjectService from "../../services/ProjectService.js";

export const deleteProjectTool = tool(
  async ({ project_id }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      await ProjectService.deleteProject(userId, project_id);
      return `Project permanently deleted (ID: ${project_id}). This cannot be undone.`;
    } catch (error) {
      return `Error deleting project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "delete_project",
    description: "Permanently delete a project. WARNING: This cannot be undone. Only use when the user explicitly asks to delete a project. Consider archive_project for soft removal instead.",
    schema: z.object({
      project_id: z.string().describe("UUID of the project to permanently delete"),
    }),
  }
);
