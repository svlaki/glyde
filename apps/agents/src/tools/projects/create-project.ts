import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ProjectService from "../../services/ProjectService.js";

export const createProjectTool = tool(
  async ({ name, aspect_id, description, deadline, details }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const existing = await ProjectService.getProjectByName(userId, name);
      if (existing) {
        return `Project "${name}" already exists (ID: ${existing.id})`;
      }

      const project = await ProjectService.createProject(userId, {
        name,
        aspect_id,
        description: description || undefined,
        deadline: deadline || undefined,
        details: details || undefined,
      });

      if (!project) {
        return "Failed to create project";
      }

      return `Created project: "${name}" (ID: ${project.id})`;
    } catch (error) {
      return `Error creating project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_project",
    description: "Create a project to group tasks and events.",
    schema: z.object({
      name: z.string().describe("Project name"),
      aspect_id: z.string().describe("Aspect UUID"),
      description: z.string().optional().nullable().describe("Description"),
      deadline: z.string().optional().nullable().describe("Deadline ISO"),
      details: z.record(z.any()).optional().nullable().describe("Details (JSON)"),
    }),
  }
);
