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
    description: "Create a new project to group related tasks and events. Projects belong to an aspect and can have a deadline. Use this when a user mentions a multi-step endeavor like 'Kitchen Renovation', 'Q2 Launch', or 'Thesis Research'.",
    schema: z.object({
      name: z.string().describe("Project name (e.g., 'Kitchen Renovation', 'Q2 Product Launch')"),
      aspect_id: z.string().describe("UUID of the aspect this project belongs to"),
      description: z.string().optional().nullable().describe("Description of the project"),
      deadline: z.string().optional().nullable().describe("Project deadline in ISO format"),
      details: z.record(z.any()).optional().nullable().describe("Additional project details as JSON"),
    }),
  }
);
