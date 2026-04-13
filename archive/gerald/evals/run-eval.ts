/**
 * Gerald Interaction Quality Eval - Main Entry Point
 *
 * Orchestrates the full evaluation pipeline:
 * 1. Load real user data from Supabase
 * 2. Generate 50 interactions via Gerald's prompt
 * 3. Simulate diverse user responses
 * 4. Process responses through Gerald (capture tool calls)
 * 5. Judge quality with LLM-as-judge
 * 6. Generate markdown + JSON report
 *
 * Usage: npx tsx src/evals/gerald/run-eval.ts
 */

import 'dotenv/config';

import { DEFAULT_EVAL_CONFIG } from './config.js';
import { loadUserData } from './data-loader.js';
import { generateInteractions } from './interaction-generator.js';
import { simulateResponses } from './response-simulator.js';
import { processResponses } from './response-processor.js';
import { judgeInteractions, judgeResponses } from './judge.js';
import { generateReport, writeReports } from './report-generator.js';

async function main() {
  const config = DEFAULT_EVAL_CONFIG;
  const startTime = Date.now();

  console.log('============================================');
  console.log('  Gerald Interaction Quality Eval');
  console.log('============================================');
  console.log(`Target: ${config.targetInteractionCount} interactions`);
  console.log(`User: ${config.userEmail}`);
  console.log(`Model: ${config.generationModel} | Judge: ${config.judgeModel}`);
  console.log('');

  // Phase 1: Load user data
  console.log('[Phase 1] Loading user data...');
  const userData = await loadUserData(config.userEmail);
  console.log(`  Profile: ${userData.profile.display_name || userData.profile.email}`);
  console.log(`  Events: ${userData.events.length} | Tasks: ${userData.tasks.length} | Goals: ${userData.goals.length}`);
  console.log(`  Aspects: ${userData.aspects.length} | Rules: ${userData.rules.length}`);
  console.log('');

  // Phase 2: Generate interactions
  console.log('[Phase 2] Generating interactions...');
  const interactions = await generateInteractions(userData, config);
  console.log(`  Generated: ${interactions.length} interactions`);
  console.log('');

  // Phase 3: Simulate responses
  console.log('[Phase 3] Simulating user responses...');
  const responses = await simulateResponses(interactions, config);
  console.log(`  Simulated: ${responses.length} responses`);
  console.log('');

  // Phase 4: Process responses through Gerald
  console.log('[Phase 4] Processing responses (Gerald RESPONSE mode)...');
  const processingResults = await processResponses(interactions, responses, userData, config);
  console.log(`  Processed: ${processingResults.length} responses`);
  console.log('');

  // Phase 5: Judge quality
  console.log('[Phase 5] Judging quality (LLM-as-judge)...');
  const [interactionScores, responseScores] = await Promise.all([
    judgeInteractions(interactions, userData, config),
    judgeResponses(processingResults, interactions, config),
  ]);
  console.log(`  Scored: ${interactionScores.length} interactions + ${responseScores.length} responses`);
  console.log('');

  // Phase 6: Generate report
  console.log('[Phase 6] Generating report...');
  const report = generateReport(
    interactions,
    responses,
    processingResults,
    interactionScores,
    responseScores,
    userData,
    config,
  );

  const { markdownPath, jsonPath } = writeReports(report, config);

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('============================================');
  console.log('  RESULTS');
  console.log('============================================');
  console.log(`  Status:            ${report.summary.passFail}`);
  console.log(`  Overall Score:     ${report.summary.overallScore}/5`);
  console.log(`  Generation Score:  ${report.summary.generationScore}/5`);
  console.log(`  Response Score:    ${report.summary.responseScore}/5`);
  console.log(`  Topic Diversity:   ${report.topicDiversity}`);
  console.log(`  Aspect Coverage:   ${Math.round(report.aspectCoverage * 100)}%`);
  console.log('');
  console.log('  Type Distribution:');
  for (const [type, count] of Object.entries(report.typeDistribution)) {
    console.log(`    ${type}: ${count}`);
  }
  console.log('');
  console.log('  Tool Usage:');
  for (const [tool, count] of Object.entries(report.toolUsageSummary).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${tool}: ${count}`);
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
