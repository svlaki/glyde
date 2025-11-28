import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createInteractionTool = tool(
  async ({ question, type, options, priority, metadata }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      const interaction = await supabaseService.createUserInteraction(userId, {
        agentId: "conversation",
        question,
        interactionType: type,
        options: options || undefined,
        priority: priority || 3,
        metadata: metadata || undefined,
      });

      if (!interaction) {
        return "❌ Failed to create interaction";
      }

      // Log interaction creation for debugging
      console.log(`✅ [create-interaction] Interaction created: ${question} (ID: ${interaction.id})`);

      return `✅ Interaction created: "${question}" (ID: ${interaction.id})`;
    } catch (error) {
      console.error('❌ [create-interaction] Error:', error);
      return `❌ Error creating interaction: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_interaction",
    description: "Create an interactive prompt with options for the user to choose from. Use this when you need to present the user with multiple options to select from, such as yes/no questions, time selections, or multiple choice options.",
    schema: z.object({
      question: z.string().describe("The question or prompt to show the user"),
      type: z.enum(["yes_no", "multiple_choice", "confirmation"]).describe("Type of interaction"),
      options: z.array(z.string()).optional().describe("Array of options for the user to choose from (e.g., ['Yes', 'No'], ['Tomorrow', 'Next Week', 'Next Month'])"),
      priority: z.number().min(1).max(5).optional().describe("Priority level (1-5, where 5 is highest). Defaults to 3"),
      metadata: z.record(z.any()).optional().describe("Optional metadata object for storing context about the interaction"),
    }),
  }
);
