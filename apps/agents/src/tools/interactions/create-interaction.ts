import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createInteractionTool = tool(
  async ({ question, type, options, priority, metadata }, config) => {
    console.log('🔧 [CREATE-INTERACTION] Tool invoked!');
    console.log('🔧 [CREATE-INTERACTION] Config:', JSON.stringify(config, null, 2));
    console.log('🔧 [CREATE-INTERACTION] Args:', JSON.stringify({ question, type, options, priority, metadata }, null, 2));

    const userId = config?.configurable?.userId;
    if (!userId) {
      console.error('🔧 [CREATE-INTERACTION] No userId in config!');
      return "❌ User ID required";
    }
    console.log('🔧 [CREATE-INTERACTION] userId:', userId);

    // Log warnings for missing metadata (but still create the interaction)
    if (type === "yes_no" && (!metadata || !metadata.followUp)) {
      console.warn('⚠️ [create-interaction] YES_NO interaction created WITHOUT followUp - clicking "yes" will do nothing!');
      console.warn('⚠️ [create-interaction] Metadata received:', JSON.stringify(metadata, null, 2));
    }

    // Log warning if directAction is missing in followUp
    if (metadata?.followUp && (!metadata.followUp.metadata?.directAction)) {
      console.warn('⚠️ [create-interaction] followUp is missing directAction - picking a time will do nothing!');
    }

    try {
      const supabaseService = getSupabaseService();

      const interaction = await supabaseService.createUserInteraction(userId, {
        agentId: "interaction",
        question,
        interactionType: type,
        options: options || undefined,
        priority: priority || 3,
        metadata: metadata || undefined,
      });

      if (!interaction) {
        return "❌ Failed to create interaction";
      }

      // NOTE: Interactions use thread history only, NOT Zep graph nodes
      // This prevents graph bloat from accumulating nodes for every user interaction
      // If future use case requires semantic search over interactions, create aggregate
      // "interaction_summary" node per session instead of per-interaction nodes

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
    description: "Create an interactive prompt for the user. CRITICAL: For yes_no type, you MUST include metadata with a followUp object containing the time selection question. Without metadata.followUp, clicking 'yes' does nothing!",
    schema: z.object({
      question: z.string().describe("The question or prompt to show the user"),
      type: z.enum(["yes_no", "multiple_choice"]).describe("Type of interaction: yes_no for simple yes/no questions, multiple_choice for options"),
      options: z.array(z.string()).optional().nullable().describe("Array of options for the user to choose from (e.g., ['Yes', 'No'], ['Tomorrow', 'Next Week', 'Next Month'])"),
      priority: z.number().min(1).max(5).optional().nullable().describe("Priority level (1-5, where 5 is highest). Defaults to 3"),
      metadata: z.record(z.any()).optional().nullable().describe("IMPORTANT for yes_no type! Should contain: { action: string, context: string, followUp: { question: string, type: 'multiple_choice', options: ['9:00am', '12:00pm', '6:00pm'], metadata: { directAction: { type: 'create_event', eventData: {...} } } } }. Without followUp, clicking 'yes' won't do anything."),
    }),
  }
);
