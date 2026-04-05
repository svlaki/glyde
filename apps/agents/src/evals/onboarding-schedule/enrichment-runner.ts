/**
 * Simulates the enrichment chat for a character.
 * An LLM plays the character, the OnboardingEnrichmentAgent responds.
 * Multi-turn conversation that progressively reveals the character's life details.
 */

import OpenAI from 'openai';
import { OnboardingEnrichmentAgent } from '../../agents/onboarding-enrichment/OnboardingEnrichmentAgent.js';
import type { CharacterSheet, EnrichmentTurn, OnboardingScheduleEvalConfig } from './types.js';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Collect the full response from the enrichment agent's stream generator.
 */
async function collectEnrichmentResponse(
  agent: OnboardingEnrichmentAgent,
  agentContext: any,
  userMessage: string,
): Promise<{ text: string; toolsCalled: string[] }> {
  let text = '';
  const toolsCalled: string[] = [];

  const stream = agent.streamMessage(agentContext, userMessage);
  for await (const event of stream) {
    if (event.type === 'text-delta' && event.content) {
      text += event.content;
    } else if (event.type === 'tool-start' && event.toolName) {
      toolsCalled.push(event.toolName);
    } else if (event.type === 'error') {
      console.warn(`  [enrichment] Stream error: ${event.content}`);
    }
  }

  return { text, toolsCalled };
}

/**
 * Generate the next user message by having an LLM play the character.
 */
async function generateCharacterResponse(
  openai: OpenAI,
  character: CharacterSheet,
  conversationHistory: readonly ConversationMessage[],
  turnNumber: number,
  config: OnboardingScheduleEvalConfig,
): Promise<string> {
  const detailsList = character.enrichmentDetails
    .map((d, i) => `${i + 1}. ${d}`)
    .join('\n');

  const alreadyShared = conversationHistory
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  const systemPrompt = `${character.personality}

You are having a conversation with Glyde, a life management app that is learning about your schedule and life. Glyde will ask you questions about your daily routine, work, school, health, hobbies, etc.

Here are the REAL details about your life that you should share during this conversation. Share them naturally when the topic comes up -- don't dump everything at once, and don't share things that weren't asked about:

${detailsList}

RULES:
- Stay in character at all times
- Answer questions directly and naturally
- Share 2-4 specific details per response (times, days, locations, names)
- If Glyde asks about something not in your details list, say you don't really have anything for that area
- Don't repeat information you already shared
- Keep responses to 2-4 sentences
- Don't ask Glyde questions back -- just answer what was asked
- On turn ${Math.min(turnNumber + 2, 8)}+, if Glyde asks if there's anything else, say something brief to wrap up

This is turn ${turnNumber + 1} of the conversation.`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // The last assistant message is what Glyde just said -- now we respond as the character
  messages.push({
    role: 'user',
    content: 'Respond as the character to what Glyde just said. Stay in character. Share relevant details from your life.',
  });

  const response = await openai.chat.completions.create({
    model: config.simulatorModel,
    messages,
    max_tokens: 300,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() || 'I think that covers everything.';
}

/**
 * Run the full enrichment chat simulation for a character.
 */
export async function runEnrichment(
  userId: string,
  character: CharacterSheet,
  config: OnboardingScheduleEvalConfig,
): Promise<{ turns: EnrichmentTurn[]; durationMs: number }> {
  const start = Date.now();

  console.log(`  [enrichment] Starting ${config.enrichmentTurns}-turn chat for ${character.name}...`);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const agent = new OnboardingEnrichmentAgent();
  await agent.initialize();

  const turns: EnrichmentTurn[] = [];
  const conversationHistory: ConversationMessage[] = [];

  for (let turn = 0; turn < config.enrichmentTurns; turn++) {
    // Generate user message
    let userMessage: string;
    if (turn === 0) {
      userMessage = `Hey! I just signed up. I'm ${character.onboardingData.preferredName || character.onboardingData.fullName}.`;
    } else {
      userMessage = await generateCharacterResponse(openai, character, conversationHistory, turn, config);
    }

    // Build agent context with conversation history
    const agentContext = {
      userId,
      sessionId: `eval-${character.id}`,
      timezone: character.onboardingData.timezone,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    // Get enrichment agent response
    const { text: agentResponse, toolsCalled } = await collectEnrichmentResponse(agent, agentContext, userMessage);

    // Track the turn
    const enrichmentTurn: EnrichmentTurn = {
      turnNumber: turn,
      userMessage,
      agentResponse,
      toolsCalled,
    };
    turns.push(enrichmentTurn);

    // Update conversation history
    conversationHistory.push({ role: 'user', content: userMessage });
    conversationHistory.push({ role: 'assistant', content: agentResponse });

    const toolSummary = toolsCalled.length > 0 ? ` [${toolsCalled.join(', ')}]` : '';
    console.log(`  [enrichment] Turn ${turn}: user=${userMessage.slice(0, 50)}... | agent=${agentResponse.slice(0, 50)}...${toolSummary}`);

    // Small delay between turns to avoid rate limiting
    if (turn < config.enrichmentTurns - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const durationMs = Date.now() - start;
  const totalTools = turns.reduce((sum, t) => sum + t.toolsCalled.length, 0);
  console.log(`  [enrichment] Complete (${Math.round(durationMs / 1000)}s) -- ${turns.length} turns, ${totalTools} tool calls`);

  return { turns, durationMs };
}
