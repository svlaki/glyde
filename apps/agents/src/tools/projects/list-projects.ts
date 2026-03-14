import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ProjectService from "../../services/ProjectService.js";

export const listProjectsTool = tool(
  async (_input, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const projects = await ProjectService.getProjects(userId);

      if (projects.length === 0) {
        return "No active projects found.";
      }

      const list = projects.map(p => {
        const deadline = p.deadline ? ` | Deadline: ${new Date(p.deadline).toLocaleDateString()}` : '';
        const aspect = p.aspect_name ? ` [${p.aspect_name}]` : '';
        return `- "${p.name}" (ID: ${p.id})${aspect}${deadline}`;
      }).join('\n');

      return `Active projects (${projects.length}):\n${list}`;
    } catch (error) {
      return `Error listing projects: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_projects",
    description: "List active projects.",
    schema: z.object({}),
  }
);
