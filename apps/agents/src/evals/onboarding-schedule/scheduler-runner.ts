/**
 * Runs the scheduler agent for a test user after enrichment.
 * Generates action suggestions and places them into time slots.
 */

import { SchedulerAgent } from '../../agents/scheduler/SchedulerAgent.js';
import type { CharacterSheet } from './types.js';

export async function runScheduler(userId: string, character: CharacterSheet): Promise<number> {
  const start = Date.now();

  console.log(`  [scheduler] Running scheduler for ${character.name}...`);

  const agent = new SchedulerAgent();
  await agent.initialize();

  const context = {
    userId,
    sessionId: `eval-${character.id}`,
    timezone: character.onboardingData.timezone,
    conversationHistory: [],
  };

  const result = await agent.processMessage(
    context,
    'Generate suggestions based on my goals, tasks, and schedule, then place them into available time slots for the next 7 days.',
  );

  const durationMs = Date.now() - start;
  const responsePreview = result.content.slice(0, 100);
  console.log(`  [scheduler] Complete (${Math.round(durationMs / 1000)}s) -- response: ${responsePreview}...`);

  return durationMs;
}
