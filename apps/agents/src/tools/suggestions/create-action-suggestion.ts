import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SuggestionService } from "../../services/SuggestionService.js";

export const createActionSuggestionTool = tool(
  async ({ title, description, suggestion_type, source_entity_type, source_entity_id, aspect_id, estimated_minutes, energy_level, metadata }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) return "User ID required";

    try {
      // Enforce minimum 60 minutes
      const minutes = estimated_minutes && estimated_minutes < 60 ? 60 : estimated_minutes;

      const service = new SuggestionService();
      const suggestion = await service.createSuggestion(userId, {
        title,
        description,
        suggestion_type,
        source_entity_type,
        source_entity_id,
        aspect_id,
        estimated_minutes: minutes,
        energy_level,
        metadata,
      });

      if (!suggestion) return "SKIPPED: A similar suggestion already exists (open or previously dismissed). Generate a DIFFERENT suggestion with a unique title.";

      return `Created action suggestion: "${suggestion.title}" (${suggestion.suggestion_type}, ${suggestion.estimated_minutes || '?'} min)`;
    } catch (error) {
      return `Error creating suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_action_suggestion",
    description: "Create a time-agnostic action suggestion in the user's backlog. These represent things the user could do to advance their goals, complete tasks, or build habits. The Scheduler agent will later place these on the calendar.",
    schema: z.object({
      title: z.string().describe("Short title for the suggestion (e.g., 'Read for an hour', 'Review CS homework')"),
      description: z.string().optional().describe("Detailed description of what to do"),
      suggestion_type: z.enum(['goal_step', 'task_step', 'prep_step', 'habit', 'general']).describe("Type of suggestion"),
      source_entity_type: z.enum(['goal', 'task', 'event', 'aspect']).optional().describe("What entity inspired this suggestion"),
      source_entity_id: z.string().uuid().optional().describe("ID of the source entity"),
      aspect_id: z.string().uuid().optional().describe("Aspect to associate with"),
      estimated_minutes: z.number().min(1).max(480).optional().describe("Estimated duration in minutes"),
      energy_level: z.enum(['low', 'medium', 'high']).optional().describe("Energy level required"),
      metadata: z.record(z.unknown()).optional().describe("Additional metadata"),
    }),
  }
);
