import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SuggestionService } from "../../services/SuggestionService.js";

export const listActionSuggestionsTool = tool(
  async ({ status, aspect_id }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) return "User ID required";

    try {
      const service = new SuggestionService();
      const suggestions = await service.listSuggestions(userId, { status, aspect_id });

      if (suggestions.length === 0) {
        return `No ${status || ''} action suggestions found.`;
      }

      const list = suggestions.map((s, i) =>
        `${i + 1}. "${s.title}" (${s.suggestion_type}, ${s.estimated_minutes || '?'} min, ${s.status})`
      ).join('\n');

      return `Found ${suggestions.length} suggestion(s):\n${list}`;
    } catch (error) {
      return `Error listing suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "list_action_suggestions",
    description: "List action suggestions from the user's backlog. Filter by status or aspect.",
    schema: z.object({
      status: z.enum(['open', 'snoozed', 'completed', 'archived']).optional().describe("Filter by status"),
      aspect_id: z.string().uuid().optional().describe("Filter by aspect"),
    }),
  }
);
