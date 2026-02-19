import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ProjectService from "../../services/ProjectService.js";

export const updateProjectTool = tool(
  async ({ project_id, name, description, deadline, aspect_id, details }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const project = await ProjectService.updateProject(userId, project_id, {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        deadline: deadline !== undefined ? deadline : undefined,
        aspect_id: aspect_id || undefined,
        details: details || undefined,
      });

      if (!project) {
        return "Project not found or failed to update";
      }

      return `Updated project: "${project.name}" (ID: ${project.id})`;
    } catch (error) {
      return `Error updating project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_project",
    description: "Update an existing project's name, description, deadline, aspect, or details.",
    schema: z.object({
      project_id: z.string().describe("UUID of the project to update"),
      name: z.string().optional().nullable().describe("New project name"),
      description: z.string().optional().nullable().describe("New description"),
      deadline: z.string().optional().nullable().describe("New deadline in ISO format, or null to clear"),
      aspect_id: z.string().optional().nullable().describe("New aspect UUID"),
      details: z.record(z.any()).optional().nullable().describe("Updated details JSON"),
    }),
  }
);
