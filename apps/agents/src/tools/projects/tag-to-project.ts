import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ProjectService from "../../services/ProjectService.js";

export const tagToProjectTool = tool(
  async ({ entity_type, entity_id, project_id }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      await ProjectService.tagEntity(userId, entity_type, entity_id, project_id);

      if (project_id) {
        return `Tagged ${entity_type} to project (project: ${project_id}, ${entity_type}: ${entity_id})`;
      }
      return `Unlinked ${entity_type} from project (${entity_type}: ${entity_id})`;
    } catch (error) {
      return `Error tagging ${entity_type}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "tag_to_project",
    description: "Tag a task or event to a project.",
    schema: z.object({
      entity_type: z.enum(["task", "event"]).describe("Entity type"),
      entity_id: z.string().describe("Entity UUID"),
      project_id: z.string().nullable().describe("Project UUID (null to unlink)"),
    }),
  }
);
