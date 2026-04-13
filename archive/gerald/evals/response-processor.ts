/**
 * Processes simulated user responses through Gerald (RESPONSE mode).
 * Captures tool calls Gerald makes in response to each answer.
 */

import OpenAI from 'openai';
import { buildEvalSystemPrompt } from './context-builder.js';
import type {
  EvalConfig,
  LoadedUserData,
  GeneratedInteraction,
  SimulatedResponse,
  ResponseProcessingResult,
  CapturedToolCall,
} from './types.js';

// Full tool schemas for Gerald's response processing mode.
// Gerald needs access to create_event, update_event, create_task, etc.
const RESPONSE_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Create a calendar event',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          description: { type: 'string', nullable: true },
          location: { type: 'string', nullable: true },
          aspect_id: { type: 'string', nullable: true },
          reminder_minutes: { type: 'number', nullable: true },
        },
        required: ['title', 'start_time', 'end_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_event',
      description: 'Update an existing calendar event',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
          title: { type: 'string', nullable: true },
          start_time: { type: 'string', nullable: true },
          end_time: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          aspect_id: { type: 'string', nullable: true },
          reminder_minutes: { type: 'number', nullable: true },
        },
        required: ['event_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          due_date: { type: 'string', nullable: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], nullable: true },
          aspect_id: { type: 'string', nullable: true },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update a task',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          title: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          status: { type: 'string', nullable: true },
          aspect_id: { type: 'string', nullable: true },
        },
        required: ['task_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: 'Create a goal',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          target_date: { type: 'string', nullable: true },
          aspect_id: { type: 'string', nullable: true },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_goal',
      description: 'Update a goal',
      parameters: {
        type: 'object',
        properties: {
          goal_id: { type: 'string' },
          title: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          progress: { type: 'number', nullable: true },
        },
        required: ['goal_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_patterns',
      description: 'Store a behavioral pattern or insight in memory',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'search'] },
          pattern: { type: 'string' },
          category: { type: 'string', nullable: true },
        },
        required: ['action', 'pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_rating',
      description: 'Create a rating score for a topic',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          score: { type: 'number' },
          description: { type: 'string', nullable: true },
          aspect_id: { type: 'string', nullable: true },
        },
        required: ['topic', 'score'],
      },
    },
  },
];

export async function processResponses(
  interactions: readonly GeneratedInteraction[],
  responses: readonly SimulatedResponse[],
  userData: LoadedUserData,
  config: EvalConfig,
): Promise<readonly ResponseProcessingResult[]> {
  const openai = new OpenAI();
  const results: ResponseProcessingResult[] = [];

  const processBatchSize = 2; // Smaller batches to avoid rate limits
  console.log(`[processor] Processing ${responses.length} responses in batches of ${processBatchSize}`);

  for (let i = 0; i < interactions.length; i += processBatchSize) {
    const batchInteractions = interactions.slice(i, i + processBatchSize);
    const batchResponses = responses.slice(i, i + processBatchSize);

    const batchResults = await Promise.all(
      batchInteractions.map((interaction, idx) =>
        processSingleResponse(openai, interaction, batchResponses[idx], userData, config)
      )
    );

    results.push(...batchResults);

    if (i + processBatchSize < interactions.length) {
      await delay(3000);
    }

    console.log(`[processor] Processed ${Math.min(i + processBatchSize, interactions.length)}/${interactions.length}`);
  }

  return results;
}

async function processSingleResponse(
  openai: OpenAI,
  interaction: GeneratedInteraction,
  response: SimulatedResponse,
  userData: LoadedUserData,
  config: EvalConfig,
): Promise<ResponseProcessingResult> {
  const systemMessage = buildEvalSystemPrompt(userData);

  // Build the exact INTERACTION RESPONSE message format from interactions.ts
  const metadataContext = interaction.metadata?.context ? ` Context: ${interaction.metadata.context}.` : '';
  const eventIdContext = interaction.metadata?.eventId ? ` Event ID to update: ${interaction.metadata.eventId}.` : '';
  const eventTitleContext = interaction.metadata?.eventTitle ? ` Event title: ${interaction.metadata.eventTitle}.` : '';

  const agentMessage = `INTERACTION RESPONSE - The user was asked: "${interaction.question}" (type: ${interaction.type}, options: ${JSON.stringify(interaction.options || [])}).${metadataContext}${eventIdContext}${eventTitleContext}

The user responded: "${response.responseText}"
Response time: 15 minutes after the interaction was created.

Based on this response, take the appropriate action using your tools. For example:
- If they said "yes" to scheduling something, create the event at a sensible time
- If they said "yes" to adding a task, create the task
- If they picked a time option, create an event at that time
- If they gave a rating (1-10), the rating is already stored automatically. No action needed.
- If they said "no" or "skip", do nothing
- If they gave a text response about what to focus on during a focus block or event, UPDATE that event's description using the update_event tool with their response as the description
- If they gave a text response (reflection, journal), acknowledge it and store useful insights

Act on what the user wants. Do NOT create new interaction questions - just execute the action.`;

  return retryWithBackoff(
    async () => {
      const completion = await openai.chat.completions.create({
        model: config.generationModel,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemMessage.content as string },
          { role: 'user', content: agentMessage },
        ],
        tools: RESPONSE_TOOLS,
        tool_choice: 'auto',
      });

      const message = completion.choices[0]?.message;
      const toolCalls: CapturedToolCall[] = (message?.tool_calls || []).map(tc => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      }));

      return {
        interactionIndex: interaction.index,
        simulatedResponse: response,
        toolCalls,
        rawResponse: message?.content || '',
      };
    },
    interaction.index,
  );
}

const MAX_RETRIES = 3;

async function retryWithBackoff(
  fn: () => Promise<ResponseProcessingResult>,
  interactionIndex: number,
): Promise<ResponseProcessingResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || error?.message?.includes('429');
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000;
        console.warn(`[processor] Rate limited on interaction ${interactionIndex}, retrying in ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(backoffMs);
      } else {
        console.error(`[processor] Error processing interaction ${interactionIndex}:`, error.message);
        return {
          interactionIndex,
          simulatedResponse: { interactionIndex, responseText: '', responseCategory: 'decline' },
          toolCalls: [],
          rawResponse: `Error: ${error.message}`,
        };
      }
    }
  }
  return {
    interactionIndex,
    simulatedResponse: { interactionIndex, responseText: '', responseCategory: 'decline' },
    toolCalls: [],
    rawResponse: 'Error: max retries exceeded',
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
