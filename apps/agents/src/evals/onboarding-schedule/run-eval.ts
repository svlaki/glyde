/**
 * Onboarding-to-Schedule Pipeline Eval - Main Entry Point
 *
 * Full pipeline per character:
 * 1. Create test user in Supabase
 * 2. Run V2 onboarding (aspects, goals, profile)
 * 3. Simulate enrichment chat (LLM plays character, enrichment agent responds)
 * 4. Run scheduler (generate suggestions + place into slots)
 * 5. Run conversation scenarios (test day-to-day agent behavior)
 * 6. Snapshot final state
 * 7. Judge enrichment + schedule + conversation behavior
 * 8. Generate markdown + JSON report with tool calls inline
 *
 * Usage:
 *   npx tsx src/evals/onboarding-schedule/run-eval.ts
 *   npx tsx src/evals/onboarding-schedule/run-eval.ts --character busy-student
 *   npx tsx src/evals/onboarding-schedule/run-eval.ts --no-conversation
 */

import 'dotenv/config';

import { DEFAULT_EVAL_CONFIG, SCORE_THRESHOLDS } from './config.js';
import { CHARACTERS, getCharacterById, getCharacterIds } from './character-sheets.js';
import { createTestUser, snapshotUserState, getTokenUsage } from './test-user-manager.js';
import { runOnboarding } from './onboarding-runner.js';
import { runEnrichment } from './enrichment-runner.js';
import { runScheduler } from './scheduler-runner.js';
import { runConversation } from './conversation-runner.js';
import { judgeEnrichment, judgeSchedule, judgeConversation } from './judge.js';
import { generateReport, writeReports } from './report-generator.js';
import type { PersonaEvalResult, PipelineResult, CharacterSheet, ConversationTurn, OnboardingScheduleEvalConfig } from './types.js';

function parseArgs(): { characters: string[]; conversationEnabled: boolean } {
  const args = process.argv.slice(2);

  const charIdx = args.indexOf('--character');
  const characters = charIdx !== -1 && args[charIdx + 1]
    ? [args[charIdx + 1]]
    : [...getCharacterIds()];

  const conversationEnabled = !args.includes('--no-conversation');

  return { characters, conversationEnabled };
}

async function runPersona(
  character: CharacterSheet,
  config: OnboardingScheduleEvalConfig,
): Promise<PersonaEvalResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${character.id}: ${character.name}`);
  console.log(`  ${character.onboardingData.occupation}${character.onboardingData.fieldOfStudy ? ` - ${character.onboardingData.fieldOfStudy}` : ''}`);
  console.log(`${'='.repeat(60)}`);

  // Phase 1: Create test user
  console.log('\n[Phase 1] Creating test user...');
  const testUser = await createTestUser(character.name, character.onboardingData.timezone);

  try {
    // Phase 2: Onboarding
    console.log('\n[Phase 2] Running onboarding...');
    const onboardingDurationMs = await runOnboarding(testUser.userId, character);

    // Phase 3: Enrichment chat
    console.log('\n[Phase 3] Running enrichment chat...');
    const { turns: enrichmentTurns, durationMs: enrichmentDurationMs } = await runEnrichment(testUser.userId, character, config);

    // Phase 4: Scheduler
    console.log('\n[Phase 4] Running scheduler...');
    const schedulerDurationMs = await runScheduler(testUser.userId, character);

    // Phase 5: Conversation scenarios
    let conversationTurns: ConversationTurn[] = [];
    let conversationDurationMs = 0;
    if (config.conversationEnabled) {
      console.log('\n[Phase 5] Running conversation scenarios...');
      const convResult = await runConversation(testUser.userId, character, config);
      conversationTurns = convResult.turns;
      conversationDurationMs = convResult.durationMs;
    } else {
      console.log('\n[Phase 5] Conversation scenarios skipped (--no-conversation)');
    }

    // Phase 6: Snapshot final state
    console.log('\n[Phase 6] Snapshotting final state...');
    const finalState = await snapshotUserState(testUser.userId);
    console.log(`  Aspects: ${finalState.aspects.length} | Recurring: ${finalState.recurringEvents.length} | Events: ${finalState.events.length}`);
    console.log(`  Tasks: ${finalState.tasks.length} | Goals: ${finalState.goals.length}`);
    console.log(`  Suggestions: ${finalState.suggestions.length} | Slots: ${finalState.placementSlots.length}`);

    // Build tool usage summary
    const toolUsageSummary: Record<string, number> = {};
    for (const turn of enrichmentTurns) {
      for (const td of turn.toolDetails) {
        toolUsageSummary[td.name] = (toolUsageSummary[td.name] || 0) + 1;
      }
    }
    for (const turn of conversationTurns) {
      for (const td of turn.toolDetails) {
        toolUsageSummary[td.name] = (toolUsageSummary[td.name] || 0) + 1;
      }
    }

    // Get token usage from agent_token_usage table
    const tokenUsage = await getTokenUsage(testUser.userId);
    if (tokenUsage.totalTokens > 0) {
      console.log(`  Tokens: ${tokenUsage.inputTokens} in / ${tokenUsage.outputTokens} out / ${tokenUsage.totalTokens} total (${tokenUsage.modelCalls} model calls)`);
    }

    const pipelineResult: PipelineResult = {
      character,
      testUserId: testUser.userId,
      onboardingDurationMs,
      enrichmentConversation: enrichmentTurns,
      enrichmentDurationMs,
      schedulerDurationMs,
      conversationTurns,
      conversationDurationMs,
      finalState,
      toolUsageSummary,
      tokenUsage,
    };

    // Phase 7: Judge
    console.log('\n[Phase 7] Judging quality...');
    const [enrichmentScore, scheduleScore] = await Promise.all([
      judgeEnrichment(character, enrichmentTurns, finalState, config),
      judgeSchedule(character, finalState, config),
    ]);

    const conversationScore = config.conversationEnabled
      ? await judgeConversation(character, conversationTurns, finalState, config)
      : { toolCorrectness: 0, responseAccuracy: 0, duplicateAvoidance: 0, contextAwareness: 0, overall: 0, reasoning: 'Skipped', scenarioResults: [] as any[] };

    const overallScore = config.conversationEnabled
      ? (enrichmentScore.overall + scheduleScore.overall + conversationScore.overall) / 3
      : (enrichmentScore.overall + scheduleScore.overall) / 2;
    const passFail = overallScore >= SCORE_THRESHOLDS.passingOverall ? 'PASS' as const : 'FAIL' as const;

    console.log(`\n  Enrichment: ${enrichmentScore.overall}/5 | Schedule: ${scheduleScore.overall}/5 | Conversation: ${conversationScore.overall}/5 | Overall: ${Math.round(overallScore * 100) / 100}/5 | ${passFail}`);

    // Print scenario pass/fail summary
    if (config.conversationEnabled && 'scenarioResults' in conversationScore) {
      const scenarioResults = (conversationScore as any).scenarioResults;
      const passed = scenarioResults.filter((s: any) => s.passed).length;
      const failed = scenarioResults.filter((s: any) => !s.passed).length;
      console.log(`  Scenarios: ${passed} passed, ${failed} failed`);
      for (const sr of scenarioResults.filter((s: any) => !s.passed)) {
        console.log(`    FAIL: ${sr.scenarioId} -- ${sr.violations.join(', ')}`);
      }
    }

    // Print tool usage
    const toolEntries = Object.entries(toolUsageSummary).sort((a, b) => b[1] - a[1]);
    if (toolEntries.length > 0) {
      console.log(`  Tool calls: ${toolEntries.map(([name, count]) => `${name}(${count})`).join(', ')}`);
    }

    return {
      characterId: character.id,
      enrichmentScore,
      scheduleScore,
      conversationScore: conversationScore as any,
      pipelineResult,
      passFail,
    };
  } finally {
    // Always clean up test user
    console.log('\n[Cleanup] Removing test user data...');
    await testUser.cleanup();
  }
}

async function main() {
  const { characters: characterIds, conversationEnabled } = parseArgs();
  const config: OnboardingScheduleEvalConfig = {
    ...DEFAULT_EVAL_CONFIG,
    conversationEnabled,
  };
  const startTime = Date.now();

  console.log('============================================');
  console.log('  Onboarding-to-Schedule Pipeline Eval');
  console.log('============================================');
  console.log(`Personas: ${characterIds.join(', ')}`);
  console.log(`Enrichment turns: ${config.enrichmentTurns}`);
  console.log(`Conversation scenarios: ${conversationEnabled ? 'enabled' : 'disabled'}`);
  console.log(`Simulator model: ${config.simulatorModel}`);
  console.log(`Judge model: ${config.judgeModel}`);
  console.log('');

  // Validate character IDs
  const characters: CharacterSheet[] = [];
  for (const id of characterIds) {
    const character = getCharacterById(id);
    if (!character) {
      console.error(`Unknown character: ${id}. Available: ${getCharacterIds().join(', ')}`);
      process.exit(1);
    }
    characters.push(character);
  }

  // Run each persona sequentially
  const results: PersonaEvalResult[] = [];
  for (const character of characters) {
    const result = await runPersona(character, config);
    results.push(result);
  }

  // Phase 8: Generate report
  console.log('\n\n[Phase 8] Generating report...');
  const report = generateReport(results, config);
  const { markdownPath, jsonPath } = writeReports(report, config);

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('============================================');
  console.log('  RESULTS');
  console.log('============================================');
  console.log(`  Status:              ${report.summary.passed}/${report.summary.totalPersonas} passed`);
  console.log(`  Avg Enrichment:      ${report.summary.avgEnrichmentScore}/5`);
  console.log(`  Avg Schedule:        ${report.summary.avgScheduleScore}/5`);
  console.log(`  Avg Conversation:    ${report.summary.avgConversationScore}/5`);
  console.log(`  Avg Overall:         ${report.summary.avgOverallScore}/5`);
  console.log(`  Total Tool Calls:    ${report.summary.totalToolCalls}`);
  console.log('');
  console.log('  Per-persona:');
  for (const r of results) {
    const overall = Math.round(
      ((r.enrichmentScore.overall + r.scheduleScore.overall + r.conversationScore.overall) / 3) * 100
    ) / 100;
    console.log(`    ${r.characterId.padEnd(20)} ${r.passFail.padEnd(6)} enrich=${r.enrichmentScore.overall} sched=${r.scheduleScore.overall} conv=${r.conversationScore.overall} overall=${overall}`);
  }
  console.log('');
  console.log('  Tool breakdown:');
  const sortedTools = Object.entries(report.summary.toolBreakdown).sort((a, b) => b[1] - a[1]);
  for (const [tool, count] of sortedTools.slice(0, 10)) {
    console.log(`    ${tool.padEnd(30)} ${count}`);
  }
  console.log('');
  console.log(`  Markdown report: ${markdownPath}`);
  console.log(`  JSON data:       ${jsonPath}`);
  console.log(`  Duration:        ${elapsed}s`);
  console.log('============================================');
}

main().catch(error => {
  console.error('Eval failed:', error);
  process.exit(1);
});
