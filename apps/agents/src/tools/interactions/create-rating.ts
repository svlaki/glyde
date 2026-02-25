import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createRatingTool = tool(
  async ({ topic, score, description, aspectId, notes }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "Error: User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      const rating = await supabaseService.createRating(userId, {
        topic,
        score,
        description: description || undefined,
        aspectId: aspectId || undefined,
        notes: notes || undefined,
      });

      if (!rating) {
        return "Failed to create rating";
      }

      return `Rating created: "${topic}" = ${score}/10 (ID: ${rating.id})`;
    } catch (error) {
      console.error('[create-rating] Error:', error);
      return `Error creating rating: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_rating",
    description: "Create or update a rating score (1-10) for a topic. Use this for tracking metrics like sleep quality, energy, mood, work-life balance, etc.",
    schema: z.object({
      topic: z.string().describe("The topic being rated (e.g., 'Sleep quality', 'Energy level', 'Work satisfaction')"),
      score: z.number().min(1).max(10).describe("Rating score from 1 (lowest) to 10 (highest)"),
      description: z.string().optional().nullable().describe("Optional description of what this rating measures"),
      aspectId: z.string().uuid().optional().nullable().describe("Aspect UUID to associate with this rating"),
      notes: z.string().optional().nullable().describe("Optional notes about this particular rating entry"),
    }),
  }
);
