/**
 * Generates interactions by calling OpenAI with Gerald's system prompt.
 * Captures create_interaction tool calls from the response.
 */

import OpenAI from 'openai';
import { buildEvalSystemPrompt } from './context-builder.js';
import type { EvalConfig, LoadedUserData, GeneratedInteraction, InteractionType } from './types.js';

const CREATE_INTERACTION_SCHEMA: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_interaction',
    description: 'Create an interactive prompt for the user.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to show the user' },
        type: {
          type: 'string',
          enum: ['yes_no', 'multiple_choice', 'text', 'rating', 'time_suggestion'],
          description: 'Interaction type',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Options for the user',
          nullable: true,
        },
        priority: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: 'Priority 1-5',
          nullable: true,
        },
        metadata: {
          type: 'object',
          description: 'Context for processing the response later',
          additionalProperties: true,
          nullable: true,
        },
        aspectId: {
          type: 'string',
          description: 'Aspect UUID for card color',
          nullable: true,
        },
      },
      required: ['question', 'type'],
    },
  },
};

const GENERATE_MESSAGE = `Analyze the user's calendar, tasks, goals, and profile. Generate 2-3 proactive interaction suggestions using the create_interaction tool. Focus on:
- Scheduling time for high-priority tasks or preparing for upcoming events
- Rating check-ins for tracked life areas (if cooldown allows)
- Reflections, goal progress, or habit tracking
- Data cleanup or miscategorization fixes
Be specific and varied. Use different interaction types.`;

export async function generateInteractions(
  userData: LoadedUserData,
  config: EvalConfig,
): Promise<readonly GeneratedInteraction[]> {
  const openai = new OpenAI();
  const allInteractions: GeneratedInteraction[] = [];
  let batchNumber = 0;

  const totalRounds = Math.ceil(config.targetInteractionCount / 2.5);

  console.log(`[generator] Starting generation: ${totalRounds} rounds targeting ${config.targetInteractionCount} interactions`);

  while (allInteractions.length < config.targetInteractionCount) {
    const remaining = config.targetInteractionCount - allInteractions.length;
    const batchCount = Math.min(config.batchSize, Math.ceil(remaining / 2.5));

    const batchPromises = Array.from({ length: batchCount }, (_, i) =>
      runSingleGeneration(openai, userData, allInteractions, batchNumber, i, config)
    );

    const batchResults = await Promise.all(batchPromises);
    const newInteractions = batchResults.flat();

    for (const interaction of newInteractions) {
      if (allInteractions.length >= config.targetInteractionCount) break;
      allInteractions.push({
        ...interaction,
        index: allInteractions.length,
      });
    }

    batchNumber++;
    console.log(`[generator] Batch ${batchNumber}: +${newInteractions.length} interactions (total: ${allInteractions.length}/${config.targetInteractionCount})`);

    if (allInteractions.length < config.targetInteractionCount) {
      await delay(config.batchDelayMs);
    }
  }

  return allInteractions;
}

async function runSingleGeneration(
  openai: OpenAI,
  userData: LoadedUserData,
  previousInteractions: readonly GeneratedInteraction[],
  batchNumber: number,
  subIndex: number,
  config: EvalConfig,
): Promise<GeneratedInteraction[]> {
  const systemMessage = buildEvalSystemPrompt(userData, previousInteractions);

  try {
    const response = await openai.chat.completions.create({
      model: config.generationModel,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemMessage.content as string },
        { role: 'user', content: GENERATE_MESSAGE },
      ],
      tools: [CREATE_INTERACTION_SCHEMA],
      tool_choice: 'auto',
    });

    const message = response.choices[0]?.message;
    if (!message?.tool_calls?.length) {
      console.warn(`[generator] No tool calls in batch ${batchNumber}-${subIndex}`);
      return [];
    }

    return message.tool_calls
      .filter(tc => tc.function.name === 'create_interaction')
      .map(tc => {
        const args = JSON.parse(tc.function.arguments);
        return {
          index: 0, // assigned later
          batchNumber,
          question: args.question,
          type: args.type as InteractionType,
          options: args.options || undefined,
          priority: args.priority || 3,
          aspectId: args.aspectId || undefined,
          metadata: args.metadata || undefined,
        };
      });
  } catch (error: any) {
    console.error(`[generator] Error in batch ${batchNumber}-${subIndex}:`, error.message);
    return [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
