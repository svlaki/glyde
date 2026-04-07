/**
 * Runs post-enrichment conversation scenarios against the ConversationAgent.
 * Each scenario tests a specific behavior pattern (schedule query, event creation, etc.)
 * and captures tool calls with details for auditing.
 */

import { ConversationAgent } from '../../agents/conversation/ConversationAgent.js';
import type {
  CharacterSheet,
  ConversationScenario,
  ConversationTurn,
  ToolCallDetail,
  OnboardingScheduleEvalConfig,
} from './types.js';

/**
 * Collect the full response from ConversationAgent's stream, capturing tool details.
 */
async function collectConversationResponse(
  agent: ConversationAgent,
  agentContext: any,
  userMessage: string,
): Promise<{ text: string; toolDetails: ToolCallDetail[] }> {
  let text = '';
  const toolDetails: ToolCallDetail[] = [];
  let currentToolName: string | null = null;

  const stream = agent.streamMessage(agentContext, userMessage);
  for await (const event of stream) {
    if (event.type === 'text-delta' && event.content) {
      text += event.content;
    } else if (event.type === 'tool-start' && event.toolName) {
      currentToolName = event.toolName;
    } else if (event.type === 'tool-end' && event.toolName) {
      const resultStr = event.toolResult
        ? (typeof event.toolResult === 'string'
          ? event.toolResult.slice(0, 500)
          : JSON.stringify(event.toolResult).slice(0, 500))
        : undefined;

      toolDetails.push({
        name: event.toolName,
        args: {},
        result: resultStr,
      });
      currentToolName = null;
    } else if (event.type === 'error') {
      console.warn(`  [conversation] Stream error: ${event.content}`);
    }
  }

  // If a tool started but never ended (edge case)
  if (currentToolName) {
    toolDetails.push({ name: currentToolName, args: {} });
  }

  return { text, toolDetails };
}

/**
 * Run a single conversation scenario and return the turn result.
 */
async function runScenario(
  agent: ConversationAgent,
  userId: string,
  character: CharacterSheet,
  scenario: ConversationScenario,
  priorTurns: ConversationTurn[],
): Promise<ConversationTurn> {
  const start = Date.now();

  // Build conversation history from prior turns in this eval
  const conversationHistory = priorTurns.flatMap(t => [
    { role: 'user' as const, content: t.userMessage },
    { role: 'assistant' as const, content: t.agentResponse },
  ]);

  const agentContext = {
    userId,
    sessionId: `eval-${character.id}-conv`,
    timezone: character.onboardingData.timezone,
    conversationHistory,
  };

  const { text, toolDetails } = await collectConversationResponse(agent, agentContext, scenario.userMessage);

  const durationMs = Date.now() - start;

  return {
    scenarioId: scenario.id,
    category: scenario.category,
    userMessage: scenario.userMessage,
    agentResponse: text,
    toolsCalled: toolDetails.map(t => t.name),
    toolDetails,
    durationMs,
  };
}

/**
 * Run all conversation scenarios for a character against the ConversationAgent.
 */
export async function runConversation(
  userId: string,
  character: CharacterSheet,
  _config: OnboardingScheduleEvalConfig,
): Promise<{ turns: ConversationTurn[]; durationMs: number }> {
  const start = Date.now();
  const scenarios = character.conversationScenarios;

  console.log(`  [conversation] Running ${scenarios.length} scenarios for ${character.name}...`);

  const agent = new ConversationAgent();
  await agent.initialize();

  const turns: ConversationTurn[] = [];

  for (const scenario of scenarios) {
    const turn = await runScenario(agent, userId, character, scenario, turns);
    turns.push(turn);

    const toolSummary = turn.toolsCalled.length > 0
      ? ` [${turn.toolsCalled.join(', ')}]`
      : ' [no tools]';
    console.log(`  [conversation] ${scenario.id} (${turn.durationMs}ms): "${scenario.userMessage.slice(0, 40)}..."${toolSummary}`);

    // Small delay between scenarios
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const durationMs = Date.now() - start;
  const totalTools = turns.reduce((sum, t) => sum + t.toolsCalled.length, 0);
  console.log(`  [conversation] Complete (${Math.round(durationMs / 1000)}s) -- ${turns.length} scenarios, ${totalTools} total tool calls`);

  return { turns, durationMs };
}
