import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createInteractionTool = tool(
  async ({ question, type, options, priority, metadata, aspectId }, config) => {
    console.log('🔧 [CREATE-INTERACTION] Tool invoked!');
    console.log('🔧 [CREATE-INTERACTION] Config:', JSON.stringify(config, null, 2));
    console.log('🔧 [CREATE-INTERACTION] Args:', JSON.stringify({ question, type, options, priority, metadata }, null, 2));

    const userId = config?.configurable?.userId;
    if (!userId) {
      console.error('🔧 [CREATE-INTERACTION] No userId in config!');
      return "❌ User ID required";
    }
    console.log('🔧 [CREATE-INTERACTION] userId:', userId);

    // Reject yes_no interactions without proper followUp metadata
    if (type === "yes_no" && (!metadata || !metadata.followUp)) {
      console.error('[create-interaction] YES_NO interaction rejected - missing metadata.followUp');
      return "Error: yes_no interactions MUST include metadata.followUp so clicking 'yes' triggers a follow-up question. Add a followUp object with question, type, options, and metadata.directAction.";
    }

    // Reject followUp without directAction (would create dead-end time selection)
    if (metadata?.followUp && (!metadata.followUp.metadata?.directAction)) {
      console.error('[create-interaction] followUp rejected - missing directAction');
      return "Error: followUp metadata MUST include metadata.directAction so selecting an option triggers an action (e.g., create_event, create_task). Add directAction with type and data fields.";
    }

    // Resolve aspectId: use provided value, or extract from metadata as fallback
    let resolvedAspectId = aspectId || null;
    if (!resolvedAspectId && metadata) {
      resolvedAspectId =
        metadata.directAction?.eventData?.aspectId ||
        metadata.directAction?.taskData?.aspectId ||
        metadata.directAction?.goalData?.categoryId ||
        metadata.followUp?.aspectId ||
        metadata.followUp?.metadata?.aspectId ||
        metadata.followUp?.metadata?.directAction?.eventData?.aspectId ||
        null;
    }

    if (!resolvedAspectId) {
      console.warn('⚠️ [create-interaction] No aspectId provided or found in metadata - interaction will have no aspect color');
    }

    try {
      const supabaseService = getSupabaseService();

      const interaction = await supabaseService.createUserInteraction(userId, {
        agentId: "interaction",
        question,
        interactionType: type,
        options: options || undefined,
        priority: priority || 3,
        aspectId: resolvedAspectId || undefined,
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
      type: z.enum(["yes_no", "multiple_choice", "text", "rating", "time_suggestion"]).describe("Type of interaction: yes_no for yes/no questions, multiple_choice for options, text for free-form responses, rating for 1-5 ratings, time_suggestion for suggesting specific times"),
      options: z.array(z.string()).optional().nullable().describe("Array of options for the user to choose from (e.g., ['Yes', 'No'], ['Tomorrow', 'Next Week', 'Next Month'])"),
      priority: z.number().min(1).max(5).optional().nullable().describe("Priority level (1-5, where 5 is highest). Defaults to 3"),
      metadata: z.record(z.any()).optional().nullable().describe("IMPORTANT for yes_no type! Should contain: { action: string, context: string, followUp: { question: string, type: 'multiple_choice', options: ['9:00am', '12:00pm', '6:00pm'], metadata: { directAction: { type: 'create_event', eventData: {...} } } } }. Without followUp, clicking 'yes' won't do anything."),
      aspectId: z.string().uuid().optional().nullable().describe("The aspect UUID to associate this interaction with. Use the aspect ID from the aspects list that best matches the topic of this interaction (e.g., a fitness suggestion should use the Health/Fitness aspect ID). This colors the interaction card on the frontend."),
    }),
  }
);
