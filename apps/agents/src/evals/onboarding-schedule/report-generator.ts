/**
 * Generates markdown and JSON reports for the onboarding-to-schedule eval.
 */

import fs from 'fs';
import path from 'path';
import type {
  PersonaEvalResult,
  OnboardingScheduleEvalConfig,
  EvalReport,
} from './types.js';
import { SCORE_THRESHOLDS } from './config.js';

export function generateReport(
  results: readonly PersonaEvalResult[],
  config: OnboardingScheduleEvalConfig,
): EvalReport {
  const enrichmentScores = results.map(r => r.enrichmentScore.overall);
  const scheduleScores = results.map(r => r.scheduleScore.overall);
  const overallScores = results.map(r => (r.enrichmentScore.overall + r.scheduleScore.overall) / 2);

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

  return {
    timestamp: new Date().toISOString(),
    config,
    results,
    summary: {
      totalPersonas: results.length,
      passed: results.filter(r => r.passFail === 'PASS').length,
      failed: results.filter(r => r.passFail === 'FAIL').length,
      avgEnrichmentScore: avg(enrichmentScores),
      avgScheduleScore: avg(scheduleScores),
      avgOverallScore: avg(overallScores),
    },
  };
}

function formatMarkdown(report: EvalReport): string {
  const lines: string[] = [];

  lines.push('# Onboarding-to-Schedule Pipeline Eval Report');
  lines.push('');
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push(`**Personas:** ${report.summary.totalPersonas}`);
  lines.push(`**Enrichment Turns:** ${report.config.enrichmentTurns}`);
  lines.push(`**Judge Model:** ${report.config.judgeModel}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Passed | ${report.summary.passed}/${report.summary.totalPersonas} |`);
  lines.push(`| Failed | ${report.summary.failed}/${report.summary.totalPersonas} |`);
  lines.push(`| Avg Enrichment Score | ${report.summary.avgEnrichmentScore}/5 |`);
  lines.push(`| Avg Schedule Score | ${report.summary.avgScheduleScore}/5 |`);
  lines.push(`| Avg Overall Score | ${report.summary.avgOverallScore}/5 |`);
  lines.push(`| Passing Threshold | ${SCORE_THRESHOLDS.passingOverall}/5 |`);
  lines.push('');

  // Per-persona results table
  lines.push('## Per-Persona Results');
  lines.push('');
  lines.push('| Persona | Enrichment | Schedule | Overall | Status |');
  lines.push('|---------|-----------|----------|---------|--------|');
  for (const r of report.results) {
    const overall = Math.round(((r.enrichmentScore.overall + r.scheduleScore.overall) / 2) * 100) / 100;
    lines.push(`| ${r.characterId} | ${r.enrichmentScore.overall}/5 | ${r.scheduleScore.overall}/5 | ${overall}/5 | ${r.passFail} |`);
  }
  lines.push('');

  // Detailed per-persona sections
  for (const r of report.results) {
    const pr = r.pipelineResult;
    lines.push(`## ${r.characterId}: ${pr.character.name}`);
    lines.push('');

    // Entity counts
    lines.push('### Data Created');
    lines.push(`- Aspects: ${pr.finalState.aspects.length}`);
    lines.push(`- Recurring Events: ${pr.finalState.recurringEvents.length}`);
    lines.push(`- One-time Events: ${pr.finalState.events.length}`);
    lines.push(`- Tasks: ${pr.finalState.tasks.length}`);
    lines.push(`- Goals: ${pr.finalState.goals.length}`);
    lines.push(`- Suggestions: ${pr.finalState.suggestions.length}`);
    lines.push(`- Placement Slots: ${pr.finalState.placementSlots.length}`);
    lines.push('');

    // Timing
    lines.push('### Timing');
    lines.push(`- Onboarding: ${pr.onboardingDurationMs}ms`);
    lines.push(`- Enrichment: ${Math.round(pr.enrichmentDurationMs / 1000)}s (${pr.enrichmentConversation.length} turns)`);
    lines.push(`- Scheduler: ${Math.round(pr.schedulerDurationMs / 1000)}s`);
    lines.push('');

    // Enrichment scores
    lines.push('### Enrichment Score');
    lines.push(`| Dimension | Score |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Aspect Discovery | ${r.enrichmentScore.aspectDiscovery}/5 |`);
    lines.push(`| Schedule Capture | ${r.enrichmentScore.scheduleCapture}/5 |`);
    lines.push(`| Goal Extraction | ${r.enrichmentScore.goalExtraction}/5 |`);
    lines.push(`| Conversation Quality | ${r.enrichmentScore.conversationQuality}/5 |`);
    lines.push(`| **Overall** | **${r.enrichmentScore.overall}/5** |`);
    lines.push('');
    lines.push(`> ${r.enrichmentScore.reasoning}`);
    lines.push('');

    // Schedule scores
    lines.push('### Schedule Score');
    lines.push(`| Dimension | Score |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Suggestion Relevance | ${r.scheduleScore.suggestionRelevance}/5 |`);
    lines.push(`| Schedule Completeness | ${r.scheduleScore.scheduleCompleteness}/5 |`);
    lines.push(`| Time Slot Quality | ${r.scheduleScore.timeSlotQuality}/5 |`);
    lines.push(`| Aspect Balance | ${r.scheduleScore.aspectBalance}/5 |`);
    lines.push(`| Description Quality | ${r.scheduleScore.descriptionQuality}/5 |`);
    lines.push(`| **Overall** | **${r.scheduleScore.overall}/5** |`);
    lines.push('');
    lines.push(`> ${r.scheduleScore.reasoning}`);
    lines.push('');

    // Conversation excerpt (first 2 + last 2 turns)
    const conv = pr.enrichmentConversation;
    if (conv.length > 0) {
      lines.push('### Conversation Excerpt');
      lines.push('');

      const excerpt = conv.length <= 4
        ? conv
        : [...conv.slice(0, 2), ...conv.slice(-2)];

      for (const turn of excerpt) {
        lines.push(`**Turn ${turn.turnNumber} - User:** ${turn.userMessage}`);
        lines.push('');
        lines.push(`**Turn ${turn.turnNumber} - Glyde:** ${turn.agentResponse.slice(0, 300)}${turn.agentResponse.length > 300 ? '...' : ''}`);
        if (turn.toolsCalled.length > 0) {
          lines.push(`*Tools: ${turn.toolsCalled.join(', ')}*`);
        }
        lines.push('');
      }

      if (conv.length > 4) {
        lines.push(`*(${conv.length - 4} turns omitted)*`);
        lines.push('');
      }
    }

    // Aspects created
    if (pr.finalState.aspects.length > 0) {
      lines.push('### Aspects Created');
      for (const a of pr.finalState.aspects) {
        lines.push(`- **${a.name}** (${a.color})${a.description ? `: ${a.description.slice(0, 80)}` : ''}`);
      }
      lines.push('');
    }

    // Suggestions
    if (pr.finalState.suggestions.length > 0) {
      lines.push('### Suggestions Generated');
      for (const s of pr.finalState.suggestions) {
        lines.push(`- **${s.title}** (${s.suggestion_type}, ${s.estimated_minutes}min, ${s.energy_level})`);
        if (s.description) {
          lines.push(`  > ${s.description.slice(0, 120)}${s.description.length > 120 ? '...' : ''}`);
        }
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Failures section
  const failures = report.results.filter(r => r.passFail === 'FAIL');
  if (failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const f of failures) {
      const overall = (f.enrichmentScore.overall + f.scheduleScore.overall) / 2;
      lines.push(`### ${f.characterId} (${overall}/5)`);
      lines.push(`- Enrichment: ${f.enrichmentScore.reasoning}`);
      lines.push(`- Schedule: ${f.scheduleScore.reasoning}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function writeReports(
  report: EvalReport,
  config: OnboardingScheduleEvalConfig,
): { markdownPath: string; jsonPath: string } {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `onboarding-eval-${timestamp}`;

  // Ensure output directory exists
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const markdownPath = path.join(config.outputDir, `${baseName}.md`);
  const jsonPath = path.join(config.outputDir, `${baseName}.json`);

  fs.writeFileSync(markdownPath, formatMarkdown(report), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  return { markdownPath, jsonPath };
}
