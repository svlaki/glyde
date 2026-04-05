/**
 * Fact extraction from conversations using gpt-4.1-mini.
 * Extracts NEW factual information about the user (preferences, patterns, identity, etc.)
 */
import OpenAI from 'openai';
import { env } from './env.js';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface ExtractedFact {
  content: string;
  category: 'preference' | 'pattern' | 'insight' | 'identity' | 'behavioral';
  confidence: number;
}

const EXTRACTION_PROMPT = `You extract factual information about the user from a conversation exchange.

Return a JSON array of facts. Each fact:
{ "content": "string describing the fact", "category": "preference|pattern|insight|identity|behavioral", "confidence": 0.0-1.0 }

Categories:
- identity: name, age, occupation, location, timezone, personal details
- preference: likes, dislikes, communication style, scheduling preferences
- pattern: recurring behaviors, habits, routines the user mentions
- insight: goals, motivations, life situation, challenges
- behavioral: how the user interacts, what they respond to, energy levels

Rules:
- Only extract NEW information not already in the existing facts list
- Skip greetings, pleasantries, and transient requests ("create an event for tomorrow")
- Skip tool call details and operational messages
- Facts should be about the USER, not about tasks/events being managed
- Be concise: each fact should be one clear sentence
- Set confidence based on how explicit the information is (direct statement = 0.9, inference = 0.6)
- If no new facts, return []

Respond ONLY with the JSON array, no other text.`;

/**
 * Extract new facts from a conversation exchange.
 * Uses gpt-4.1-mini for cost efficiency.
 */
export async function extractFacts(
  userMessage: string,
  assistantResponse: string,
  existingFacts: string[]
): Promise<ExtractedFact[]> {
  const client = getClient();

  const existingContext = existingFacts.length > 0
    ? `\n\nExisting facts (do NOT duplicate these):\n${existingFacts.map(f => `- ${f}`).join('\n')}`
    : '';

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `User message: ${userMessage}\n\nAssistant response: ${assistantResponse.substring(0, 500)}${existingContext}`
        }
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content || content === '[]') return [];

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];

    // Validate and filter
    return parsed.filter((f: any) =>
      typeof f.content === 'string' &&
      f.content.length > 5 &&
      ['preference', 'pattern', 'insight', 'identity', 'behavioral'].includes(f.category) &&
      typeof f.confidence === 'number' &&
      f.confidence >= 0 && f.confidence <= 1
    );
  } catch (error) {
    console.error('[FactExtractor] Extraction failed:', error);
    return [];
  }
}
