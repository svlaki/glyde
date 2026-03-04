import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

// Common words that inflate overlap without indicating topic similarity
const DEDUP_STOP_WORDS = new Set([
  // Standard stop words
  'the', 'this', 'that', 'what', 'when', 'where', 'which', 'who', 'whom',
  'have', 'has', 'had', 'been', 'being', 'will', 'would', 'could', 'should',
  'about', 'after', 'before', 'between', 'from', 'into', 'with', 'your',
  'you', 'they', 'them', 'their', 'some', 'more', 'most', 'other', 'over',
  // Interaction-framework words (appear in most questions regardless of topic)
  'want', 'like', 'schedule', 'block', 'time', 'today', 'tomorrow',
  'morning', 'afternoon', 'evening', 'night', 'week', 'past', 'days',
  'rate', 'rating', 'think', 'thinking', 'feel', 'feeling',
  'suggest', 'suggestion', 'something', 'anything', 'many', 'much',
  'good', 'well', 'also', 'just', 'still', 'even', 'really', 'very',
  'done', 'doing', 'going', 'make', 'take', 'keep', 'help',
  'minute', 'minutes', 'hour', 'hours', 'session', 'focus', 'quick',
  'slot', 'free', 'during', 'recently', 'lately',
]);

/**
 * Extract meaningful topic words from a question, filtering out stop words
 * and common interaction-framework words.
 */
function extractTopicWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length > 2 && !DEDUP_STOP_WORDS.has(w));
}

export const createInteractionTool = tool(
  async ({ question, type, options, priority, metadata, aspectId, expiresAt }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      // Dedup check: reject if a pending interaction with similar topic already exists
      const pendingInteractions = await supabaseService.getPendingUserInteractions(userId, 'interaction');
      const questionLower = question.toLowerCase();
      const topicWords = extractTopicWords(question);
      const isDuplicate = pendingInteractions.some((existing: any) => {
        const existingLower = (existing.question || '').toLowerCase();
        if (existingLower === questionLower) return true;
        const existingTopicWords = extractTopicWords(existing.question || '');
        // Skip overlap check for very short questions to avoid false positives
        if (topicWords.length < 2 || existingTopicWords.length < 2) return false;
        const overlapA = topicWords.filter((w: string) => existingTopicWords.includes(w)).length;
        const overlapB = existingTopicWords.filter((w: string) => topicWords.includes(w)).length;
        const ratioA = overlapA / topicWords.length;
        const ratioB = overlapB / existingTopicWords.length;
        // Use the MAX ratio (either direction) with a lower threshold
        // This catches cases where one question's topic words are a subset of another's
        return Math.max(ratioA, ratioB) > 0.5;
      });

      if (isDuplicate) {
        console.log(`[create-interaction] BLOCKED duplicate: "${question}"`);
        return `Skipped: A similar interaction is already pending. Choose a completely different topic.`;
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
    description: "Create an interactive prompt for the user. The user's response will be routed back to you for processing with tools. Keep metadata.context descriptive so you have context when processing the response.",
    schema: z.object({
      question: z.string().describe("The question or prompt to show the user"),
      type: z.enum(["yes_no", "multiple_choice", "text", "rating", "time_suggestion"]).describe("Interaction type"),
      options: z.array(z.string()).optional().nullable().describe("Options for the user to choose from"),
      priority: z.number().min(1).max(5).optional().nullable().describe("Priority 1-5 (5 highest). Default 3"),
      metadata: z.record(z.any()).optional().nullable().describe("Context for processing the response later. Include 'context' (why this was suggested), 'ratingTopic' (for ratings), 'eventTitle' and 'duration' (for scheduling), 'eventId'/'taskId' (for updates)."),
      aspectId: z.string().uuid().optional().nullable().describe("Aspect UUID for card color. ALWAYS provide this."),
      expiresAt: z.string().optional().nullable().describe("ISO datetime when this interaction expires. MUST be set before any referenced event starts, so stale interactions don't linger. Defaults to 24h if not set."),
    }),
  }
);
