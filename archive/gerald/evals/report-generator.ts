/**
 * Generates evaluation reports in markdown and JSON formats.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  EvalConfig,
  LoadedUserData,
  GeneratedInteraction,
  SimulatedResponse,
  ResponseProcessingResult,
  InteractionScore,
  ResponseScore,
  EvalResult,
  EvalReport,
} from './types.js';
import { SCORE_THRESHOLDS } from './config.js';

export function generateReport(
  interactions: readonly GeneratedInteraction[],
  responses: readonly SimulatedResponse[],
  processingResults: readonly ResponseProcessingResult[],
  interactionScores: readonly InteractionScore[],
  responseScores: readonly ResponseScore[],
  userData: LoadedUserData,
  config: EvalConfig,
): EvalReport {
  // Assemble eval results
  const results: EvalResult[] = interactions.map((interaction, i) => ({
    interaction,
    interactionScore: interactionScores[i],
    response: responses[i],
    responseProcessing: processingResults[i],
    responseScore: responseScores[i],
  }));

  // Compute scores
  const avgGeneration = average(interactionScores.map(s => s.overall));
  const avgResponse = average(responseScores.map(s => s.overall));
  const overallScore = (avgGeneration + avgResponse) / 2;
  const passFail = overallScore >= SCORE_THRESHOLDS.passingOverall ? 'PASS' : 'FAIL';

  // Type distribution
  const typeDistribution = interactions.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Aspect coverage
  const usedAspects = new Set(interactions.map(i => i.aspectId).filter(Boolean));
  const totalAspects = userData.aspects.length || 1;
  const aspectCoverage = usedAspects.size / totalAspects;

  // Topic diversity (simple unique word ratio)
  const topicDiversity = computeTopicDiversity(interactions);

  // Tool usage summary
  const toolUsageSummary = processingResults.reduce((acc, r) => {
    if (r.toolCalls.length === 0) {
      acc['(no action)'] = (acc['(no action)'] || 0) + 1;
    }
    for (const tc of r.toolCalls) {
      acc[tc.name] = (acc[tc.name] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Top/bottom interactions by overall score
  const sorted = [...results].sort(
    (a, b) => b.interactionScore.overall - a.interactionScore.overall
  );
  const topInteractions = sorted.slice(0, 5);
  const bottomInteractions = sorted.slice(-5).reverse();

  return {
    timestamp: new Date().toISOString(),
    config,
    userData: {
      userId: userData.userId,
      email: userData.profile.email,
      timezone: userData.profile.timezone || 'UTC',
      displayName: userData.profile.display_name || userData.profile.email,
    },
    summary: {
      totalInteractions: interactions.length,
      overallScore: round(overallScore),
      generationScore: round(avgGeneration),
      responseScore: round(avgResponse),
      passFail,
    },
    typeDistribution,
    aspectCoverage: round(aspectCoverage),
    topicDiversity: round(topicDiversity),
    results,
    topInteractions,
    bottomInteractions,
    toolUsageSummary,
  };
}

export function writeReports(report: EvalReport, config: EvalConfig): { markdownPath: string; jsonPath: string } {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputDir = path.resolve(config.outputDir);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const markdownPath = path.join(outputDir, `gerald-eval-${timestamp}.md`);
  const jsonPath = path.join(outputDir, `gerald-eval-${timestamp}.json`);

  fs.writeFileSync(markdownPath, generateMarkdown(report));
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  return { markdownPath, jsonPath };
}

function generateMarkdown(report: EvalReport): string {
  const { summary, typeDistribution, toolUsageSummary } = report;

  const genDimensions = computeDimensionStats(report.results.map(r => r.interactionScore), [
    'contextRelevance', 'specificity', 'appropriateness', 'metadataQuality', 'overall',
  ]);

  const respDimensions = computeDimensionStats(report.results.map(r => r.responseScore), [
    'actionCorrectness', 'toolSelection', 'minimalAction', 'overall',
  ]);

  return `# Gerald Interaction Quality Eval Report
Date: ${report.timestamp}
User: ${report.userData.displayName} (${report.userData.email})
Timezone: ${report.userData.timezone}

## Summary

| Metric | Score | Threshold | Status |
|--------|-------|-----------|--------|
| Overall | ${summary.overallScore}/5 | ${SCORE_THRESHOLDS.passingOverall} | ${summary.passFail} |
| Generation Quality | ${summary.generationScore}/5 | ${SCORE_THRESHOLDS.passingGeneration} | ${summary.generationScore >= SCORE_THRESHOLDS.passingGeneration ? 'PASS' : 'FAIL'} |
| Response Handling | ${summary.responseScore}/5 | ${SCORE_THRESHOLDS.passingResponse} | ${summary.responseScore >= SCORE_THRESHOLDS.passingResponse ? 'PASS' : 'FAIL'} |
| Topic Diversity | ${report.topicDiversity} | ${SCORE_THRESHOLDS.minimumDiversity} | ${report.topicDiversity >= SCORE_THRESHOLDS.minimumDiversity ? 'PASS' : 'FAIL'} |
| Aspect Coverage | ${Math.round(report.aspectCoverage * 100)}% | - | - |

Total interactions evaluated: ${summary.totalInteractions}

## Generation Quality Breakdown

| Dimension | Average | Min | Max |
|-----------|---------|-----|-----|
${genDimensions.map(d => `| ${d.name} | ${d.avg} | ${d.min} | ${d.max} |`).join('\n')}

## Response Handling Breakdown

| Dimension | Average | Min | Max |
|-----------|---------|-----|-----|
${respDimensions.map(d => `| ${d.name} | ${d.avg} | ${d.min} | ${d.max} |`).join('\n')}

## Interaction Type Distribution

| Type | Count | % |
|------|-------|---|
${Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]).map(([type, count]) =>
  `| ${type} | ${count} | ${Math.round(count / summary.totalInteractions * 100)}% |`
).join('\n')}

## Tool Usage Summary

| Tool | Call Count | % of Responses |
|------|------------|----------------|
${Object.entries(toolUsageSummary).sort((a, b) => b[1] - a[1]).map(([tool, count]) =>
  `| ${tool} | ${count} | ${Math.round(count / summary.totalInteractions * 100)}% |`
).join('\n')}

## Top 5 Best Interactions

${report.topInteractions.map((r, i) => `${i + 1}. **Q:** "${r.interaction.question}"
   - Type: ${r.interaction.type} | Score: ${r.interactionScore.overall}/5
   - ${r.interactionScore.reasoning}
`).join('\n')}

## Bottom 5 Worst Interactions

${report.bottomInteractions.map((r, i) => `${i + 1}. **Q:** "${r.interaction.question}"
   - Type: ${r.interaction.type} | Score: ${r.interactionScore.overall}/5
   - ${r.interactionScore.reasoning}
`).join('\n')}

## Sample Response Handling Details

${report.results.slice(0, 10).map((r, i) => {
  const toolStr = r.responseProcessing.toolCalls.length === 0
    ? '(no action)'
    : r.responseProcessing.toolCalls.map(tc => `${tc.name}`).join(', ');
  return `${i + 1}. **Q:** "${r.interaction.question}" (${r.interaction.type})
   **Response:** "${r.response.responseText}" [${r.response.responseCategory}]
   **Actions:** ${toolStr}
   **Score:** ${r.responseScore.overall}/5 - ${r.responseScore.reasoning}
`;
}).join('\n')}

---
Generated by Gerald Eval Framework
Model: ${report.config.generationModel} | Judge: ${report.config.judgeModel}
`;
}

function computeDimensionStats(
  scores: readonly Record<string, any>[],
  dimensions: readonly string[],
): { name: string; avg: number; min: number; max: number }[] {
  return dimensions.map(dim => {
    const values = scores.map(s => s[dim] as number).filter(v => typeof v === 'number');
    return {
      name: dim,
      avg: round(average(values)),
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });
}

function computeTopicDiversity(interactions: readonly GeneratedInteraction[]): number {
  // Extract key words from each question and measure uniqueness
  const allWords = interactions.flatMap(i =>
    i.question.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  );
  const uniqueWords = new Set(allWords);
  return uniqueWords.size / Math.max(allWords.length, 1);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
