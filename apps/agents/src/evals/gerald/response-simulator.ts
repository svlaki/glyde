/**
 * Simulates diverse user responses for each generated interaction.
 * Uses a mix of template-based and LLM-generated responses.
 */

import OpenAI from 'openai';
import { RESPONSE_DISTRIBUTION } from './config.js';
import type { EvalConfig, GeneratedInteraction, SimulatedResponse, ResponseCategory } from './types.js';

export async function simulateResponses(
  interactions: readonly GeneratedInteraction[],
  config: EvalConfig,
): Promise<readonly SimulatedResponse[]> {
  const openai = new OpenAI();
  const results: SimulatedResponse[] = [];

  for (let i = 0; i < interactions.length; i++) {
    const category = pickResponseCategory(i);
    const response = await simulateSingleResponse(openai, interactions[i], category, config);
    results.push(response);
  }

  console.log(`[simulator] Generated ${results.length} responses`);
  const categoryCounts = results.reduce((acc, r) => {
    acc[r.responseCategory] = (acc[r.responseCategory] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[simulator] Distribution:`, categoryCounts);

  return results;
}

function pickResponseCategory(index: number): ResponseCategory {
  const normalized = (index % 10) / 10;

  if (normalized < RESPONSE_DISTRIBUTION.accept) return 'accept';
  if (normalized < RESPONSE_DISTRIBUTION.accept + RESPONSE_DISTRIBUTION.specific) return 'specific';
  if (normalized < RESPONSE_DISTRIBUTION.accept + RESPONSE_DISTRIBUTION.specific + RESPONSE_DISTRIBUTION.decline) return 'decline';
  return 'edge_case';
}

async function simulateSingleResponse(
  openai: OpenAI,
  interaction: GeneratedInteraction,
  category: ResponseCategory,
  config: EvalConfig,
): Promise<SimulatedResponse> {
  const { type, question, options } = interaction;

  switch (type) {
    case 'yes_no':
      return simulateYesNo(interaction, category);
    case 'multiple_choice':
      return simulateMultipleChoice(interaction, category);
    case 'text':
      return await simulateText(openai, interaction, category, config);
    case 'rating':
      return simulateRating(interaction, category);
    case 'time_suggestion':
      return simulateTimeSuggestion(interaction, category);
    default:
      return {
        interactionIndex: interaction.index,
        responseText: 'Yes',
        responseCategory: category,
      };
  }
}

function simulateYesNo(
  interaction: GeneratedInteraction,
  category: ResponseCategory,
): SimulatedResponse {
  const responses: Record<ResponseCategory, string> = {
    accept: 'Yes',
    specific: 'Yes, and make it 45 minutes please',
    decline: 'No thanks',
    edge_case: 'Maybe later',
  };

  return {
    interactionIndex: interaction.index,
    responseText: responses[category],
    responseCategory: category,
  };
}

function simulateMultipleChoice(
  interaction: GeneratedInteraction,
  category: ResponseCategory,
): SimulatedResponse {
  const opts = interaction.options || [];

  const responseMap: Record<ResponseCategory, string> = {
    accept: opts[0] || 'First option',
    specific: opts[Math.min(1, opts.length - 1)] || 'Second option',
    decline: 'None of these',
    edge_case: 'All of the above',
  };

  return {
    interactionIndex: interaction.index,
    responseText: responseMap[category],
    responseCategory: category,
  };
}

async function simulateText(
  openai: OpenAI,
  interaction: GeneratedInteraction,
  category: ResponseCategory,
  config: EvalConfig,
): Promise<SimulatedResponse> {
  if (category === 'decline') {
    return {
      interactionIndex: interaction.index,
      responseText: 'Skip',
      responseCategory: category,
    };
  }

  if (category === 'edge_case') {
    return {
      interactionIndex: interaction.index,
      responseText: 'idk',
      responseCategory: category,
    };
  }

  // Use LLM for accept/specific text responses
  try {
    const prompt = category === 'accept'
      ? `The AI assistant asked: "${interaction.question}". Give a brief, natural response (1-2 sentences). Be genuine and specific.`
      : `The AI assistant asked: "${interaction.question}". Give a detailed, thoughtful response (2-3 sentences). Include specific details about your day or feelings.`;

    const response = await openai.chat.completions.create({
      model: config.responseSimModel,
      temperature: 0.7,
      max_tokens: 100,
      messages: [
        { role: 'system', content: 'You are a busy college student. Respond naturally and briefly.' },
        { role: 'user', content: prompt },
      ],
    });

    return {
      interactionIndex: interaction.index,
      responseText: response.choices[0]?.message?.content?.trim() || 'Sounds good',
      responseCategory: category,
    };
  } catch {
    return {
      interactionIndex: interaction.index,
      responseText: 'Sounds good, let me think about that',
      responseCategory: category,
    };
  }
}

function simulateRating(
  interaction: GeneratedInteraction,
  category: ResponseCategory,
): SimulatedResponse {
  const ratingMap: Record<ResponseCategory, string> = {
    accept: '7',
    specific: '5',
    decline: 'Skip',
    edge_case: '3',
  };

  return {
    interactionIndex: interaction.index,
    responseText: ratingMap[category],
    responseCategory: category,
  };
}

function simulateTimeSuggestion(
  interaction: GeneratedInteraction,
  category: ResponseCategory,
): SimulatedResponse {
  const opts = interaction.options || [];

  const responseMap: Record<ResponseCategory, string> = {
    accept: opts[0] || '2:00pm',
    specific: opts[Math.min(2, opts.length - 1)] || '4:00pm',
    decline: 'Not today',
    edge_case: 'Whenever works',
  };

  return {
    interactionIndex: interaction.index,
    responseText: responseMap[category],
    responseCategory: category,
  };
}
