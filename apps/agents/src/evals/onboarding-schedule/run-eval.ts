/**
 * Onboarding-to-Schedule Pipeline Eval - Main Entry Point
 *
 * Orchestrates the full evaluation pipeline for each character:
 * 1. Create test user in Supabase
 * 2. Run V2 onboarding (aspects, goals, profile)
 * 3. Simulate enrichment chat (LLM plays character, enrichment agent responds)
 * 4. Run scheduler (generate suggestions + place into slots)
 * 5. Snapshot final state
 * 6. Judge enrichment + schedule quality
 * 7. Generate markdown + JSON report
 *
 * Usage:
 *   npx tsx src/evals/onboarding-schedule/run-eval.ts
 *   npx tsx src/evals/onboarding-schedule/run-eval.ts --character busy-student
 */

import 'dotenv/config';

import { DEFAULT_EVAL_CONFIG, SCORE_THRESHOLDS } from './config.js';
import { CHARACTERS, getCharacterById, getCharacterIds } from './character-sheets.js';
import { createTestUser, snapshotUserState } from './test-user-manager.js';
import { runOnboarding } from './onboarding-runner.js';
import { runEnrichment } from './enrichment-runner.js';
import { runScheduler } from './scheduler-runner.js';
import { judgeEnrichment, judgeSchedule } from './judge.js';
import { generateReport, writeReports } from './report-generator.js';
import type { PersonaEvalResult, PipelineResult, CharacterSheet } from './types.js';

function parseArgs(): { characters: string[] } {
  const args = process.argv.slice(2);
  const charIdx = args.indexOf('--character');
  if (charIdx !== -1 && args[charIdx + 1]) {
    return { characters: [args[charIdx + 1]] };
  }
  return { characters: [...getCharacterIds()] };
}

async function runPersona(character: CharacterSheet, config: typeof DEFAULT_EVAL_CONFIG): Promise<PersonaEvalResult> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${character.id}: ${character.name}`);
  console.log(`  ${character.onboardingData.occupation}${character.onboardingData.fieldOfStudy ? ` - ${character.onboardingData.fieldOfStudy}` : ''}`);
  console.log(`${'='.repeat(50)}`);

  // Phase 1: Create test user
  console.log('\n[Phase 1] Creating test user...');
  const testUser = await createTestUser(character.name, character.onboardingData.timezone);

  try {
    // Phase 2: Onboarding
    console.log('\n[Phase 2] Running onboarding...');
    const onboardingDurationMs = await runOnboarding(testUser.userId, character);

    // Phase 3: Enrichment chat
    console.log('\n[Phase 3] Running enrichment chat...');
    const { turns, durationMs: enrichmentDurationMs } = await runEnrichment(testUser.userId, character, config);

    // Phase 4: Scheduler
    console.log('\n[Phase 4] Running scheduler...');
    const schedulerDurationMs = await runScheduler(testUser.userId, character);

    // Phase 5: Snapshot final state
    console.log('\n[Phase 5] Snapshotting final state...');
    const finalState = await snapshotUserState(testUser.userId);
    console.log(`  Aspects: ${finalState.aspects.length} | Recurring: ${finalState.recurringEvents.length} | Events: ${finalState.events.length}`);
    console.log(`  Tasks: ${finalState.tasks.length} | Goals: ${finalState.goals.length}`);
    console.log(`  Suggestions: ${finalState.suggestions.length} | Slots: ${finalState.placementSlots.length}`);

    const pipelineResult: PipelineResult = {
      character,
      testUserId: testUser.userId,
      onboardingDurationMs,
      enrichmentConversation: turns,
      enrichmentDurationMs,
      schedulerDurationMs,
      finalState,
    };

    // Phase 6: Judge
    console.log('\n[Phase 6] Judging quality...');
    const [enrichmentScore, scheduleScore] = await Promise.all([
      judgeEnrichment(character, turns, finalState, config),
      judgeSchedule(character, finalState, config),
    ]);

    const overallScore = (enrichmentScore.overall + scheduleScore.overall) / 2;
    const passFail = overallScore >= SCORE_THRESHOLDS.passingOverall ? 'PASS' as const : 'FAIL' as const;

    console.log(`\n  Enrichment: ${enrichmentScore.overall}/5 | Schedule: ${scheduleScore.overall}/5 | Overall: ${overallScore}/5 | ${passFail}`);

    return {
      characterId: character.id,
      enrichmentScore,
      scheduleScore,
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
  const config = DEFAULT_EVAL_CONFIG;
  const { characters: characterIds } = parseArgs();
  const startTime = Date.now();

  console.log('============================================');
  console.log('  Onboarding-to-Schedule Pipeline Eval');
  console.log('============================================');
  console.log(`Personas: ${characterIds.join(', ')}`);
  console.log(`Enrichment turns: ${config.enrichmentTurns}`);
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

  // Run each persona sequentially (they use real Supabase + LLM calls)
  const results: PersonaEvalResult[] = [];
  for (const character of characters) {
    const result = await runPersona(character, config);
    results.push(result);
  }

  // Phase 7: Generate report
  console.log('\n\n[Phase 7] Generating report...');
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
  console.log(`  Avg Overall:         ${report.summary.avgOverallScore}/5`);
  console.log('');
  console.log('  Per-persona:');
  for (const r of results) {
    const overall = Math.round(((r.enrichmentScore.overall + r.scheduleScore.overall) / 2) * 100) / 100;
    console.log(`    ${r.characterId.padEnd(20)} ${r.passFail.padEnd(6)} enrichment=${r.enrichmentScore.overall} schedule=${r.scheduleScore.overall} overall=${overall}`);
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
