import { tool } from "@langchain/core/tools";
import { z } from "zod";
import AspectService from "../../services/AspectService.js";

export const createAspectTool = tool(
  async ({ name, color, description, context }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      // Check if aspect already exists
      const existing = await AspectService.getAspectByName(userId, name);
      if (existing) {
        return `Aspect "${name}" already exists with color ${existing.color}`;
      }

      const aspect = await AspectService.createAspect(userId, {
        name,
        color: color || '#3b82f6',
        description: description || undefined,
        context: context || undefined,
      });

      if (!aspect) {
        return "Failed to create aspect";
      }

      return `Created aspect: "${name}" (${color || '#3b82f6'})`;
    } catch (error) {
      console.error('[create-aspect] Error:', error);
      return `Error creating aspect: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_aspect",
    description: "Create a new aspect for organizing events, tasks, and goals. Aspects are universal and can be used by all entity types. CRITICAL: Create SPECIFIC, GRANULAR aspects for specific entities - individual classes (e.g., 'CS173A', 'PHIL 1'), projects (e.g., 'Project Phoenix'), clients (e.g., 'Client Acme'). Generic aspects (Personal, Fitness, Social) should ONLY be used for truly generic recurring activities. Always check existing aspects with list_aspects before creating.",
    schema: z.object({
      name: z.string().describe("Aspect name (e.g., 'Gym', 'Project X', 'Doctor Appointments')"),
      color: z.string().optional().nullable().describe("Hex color code (e.g., '#3b82f6'). Use meaningful colors that match the aspect type."),
      description: z.string().optional().nullable().describe("Description of what this aspect is for"),
      context: z.record(z.any()).optional().nullable().describe("AI context object with preferences and patterns for this aspect"),
    }),
  }
);
