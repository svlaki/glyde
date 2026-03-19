import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createInteractionTool = tool(
  async ({ question, type, options, priority, metadata, aspectId, expiresAt }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      // Dedup check: reject if a similar interaction exists (pending OR recently responded)
      const pendingInteractions = await supabaseService.getPendingUserInteractions(userId, 'interaction');
      const recentInteractions = await supabaseService.getRecentUserInteractions(userId, 20, 6);
      const allRecentInteractions = [...pendingInteractions, ...recentInteractions];

      // Deduplicate the combined list by ID
      const seenIds = new Set<string>();
      const uniqueInteractions = allRecentInteractions.filter((i: any) => {
        if (seenIds.has(i.id)) return false;
        seenIds.add(i.id);
        return true;
      });

      const questionLower = question.toLowerCase();
      const questionWords = questionLower.split(/\s+/).filter((w: string) => w.length > 3);
      const newEventTitle = (metadata?.eventTitle || '').toLowerCase();

      const isDuplicate = uniqueInteractions.some((existing: any) => {
        const existingLower = (existing.question || '').toLowerCase();

        // Exact match
        if (existingLower === questionLower) return true;

        // Same eventTitle in metadata = same topic
        const existingEventTitle = (existing.metadata?.eventTitle || '').toLowerCase();
        if (newEventTitle && existingEventTitle && newEventTitle === existingEventTitle) return true;

        // Word overlap check
        const existingWords = existingLower.split(/\s+/).filter((w: string) => w.length > 3);
        if (questionWords.length < 3 || existingWords.length < 3) return false;
        const overlapA = questionWords.filter((w: string) => existingWords.includes(w)).length;
        const overlapB = existingWords.filter((w: string) => questionWords.includes(w)).length;
        const ratioA = overlapA / questionWords.length;
        const ratioB = overlapB / existingWords.length;
        return Math.min(ratioA, ratioB) > 0.6;
      });

      if (isDuplicate) {
        console.log(`[create-interaction] BLOCKED duplicate: "${question}"`);
        return `Skipped: A similar interaction was already asked recently. Choose a completely different topic.`;
      }

      // Rating cooldown check: block rating interactions if the same topic was rated within 5 days
      if (type === 'rating' && metadata?.ratingTopic) {
        const ratingSummary = await supabaseService.getRatingSummary(userId);
        const topicLower = (metadata.ratingTopic as string).toLowerCase();
        const recentRating = ratingSummary.find((r: any) => {
          const rTopicLower = (r.topic || '').toLowerCase();
          return rTopicLower === topicLower;
        });

        if (recentRating) {
          const daysSince = Math.round(
            (Date.now() - new Date(recentRating.lastAsked).getTime()) / 86400000
          );
          if (daysSince < 5) {
            console.log(`[create-interaction] BLOCKED rating cooldown: "${metadata.ratingTopic}" was asked ${daysSince} days ago (minimum 5)`);
            return `Skipped: Rating topic "${metadata.ratingTopic}" was last asked ${daysSince} day(s) ago. Minimum interval is 5 days. Choose a different topic.`;
          }
        }
      }

      // Resolve aspectId from parameter or metadata
      let resolvedAspectId = aspectId || null;
      if (!resolvedAspectId && metadata) {
        resolvedAspectId = metadata.aspectId || null;
      }

      const interaction = await supabaseService.createUserInteraction(userId, {
        agentId: "interaction",
        question,
        interactionType: type,
        options: options || undefined,
        priority: priority || 3,
        aspectId: resolvedAspectId || undefined,
        metadata: metadata || undefined,
        expiresAt: expiresAt || undefined,
      });

      if (!interaction) {
        return "Failed to create interaction";
      }

      console.log(`[create-interaction] Created: "${question}" (ID: ${interaction.id})`);
      return `Interaction created: "${question}" (ID: ${interaction.id})`;
    } catch (error) {
      console.error('[create-interaction] Error:', error);
      return `Error creating interaction: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_interaction",
    description: "Create an interactive prompt card for the user.",
    schema: z.object({
      question: z.string().describe("Question to show"),
      type: z.enum(["yes_no", "multiple_choice", "text", "rating", "time_suggestion"]).describe("Interaction type"),
      options: z.array(z.string()).optional().nullable().describe("Choices"),
      priority: z.number().min(1).max(5).optional().nullable().describe("Priority 1-5"),
      metadata: z.record(z.any()).optional().nullable().describe("Context for response processing (JSON)"),
      aspectId: z.string().uuid().optional().nullable().describe("Aspect UUID"),
      expiresAt: z.string().optional().nullable().describe("Expiry time ISO. Interactions expire and disappear after this time."),
    }),
  }
);
