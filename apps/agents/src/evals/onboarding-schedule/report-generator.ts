/**
 * Generates markdown and JSON reports for the onboarding-to-schedule eval.
 * Tool calls are shown inline with each message for auditability.
 */

import fs from 'fs';
import path from 'path';
import type {
  PersonaEvalResult,
  OnboardingScheduleEvalConfig,
  EvalReport,
  EnrichmentTurn,
  ConversationTurn,
  ToolCallDetail,
} from './types.js';
import { SCORE_THRESHOLDS } from './config.js';
import { getAllCriteria } from './behavior-criteria.js';

function buildToolUsageSummary(results: readonly PersonaEvalResult[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const r of results) {
    const pr = r.pipelineResult;
    for (const turn of pr.enrichmentConversation) {
      for (const td of turn.toolDetails) {
        summary[td.name] = (summary[td.name] || 0) + 1;
      }
    }
    for (const turn of pr.conversationTurns) {
      for (const td of turn.toolDetails) {
        summary[td.name] = (summary[td.name] || 0) + 1;
      }
    }
  }
  return summary;
}

export function generateReport(
  results: readonly PersonaEvalResult[],
  config: OnboardingScheduleEvalConfig,
): EvalReport {
  const enrichmentScores = results.map(r => r.enrichmentScore.overall);
  const scheduleScores = results.map(r => r.scheduleScore.overall);
  const conversationScores = results.map(r => r.conversationScore.overall);
  const overallScores = results.map(r =>
    (r.enrichmentScore.overall + r.scheduleScore.overall + r.conversationScore.overall) / 3
  );

  const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

  const toolBreakdown = buildToolUsageSummary(results);
  const totalToolCalls = Object.values(toolBreakdown).reduce((a, b) => a + b, 0);

  return {
    timestamp: new Date().toISOString(),
    config,
    results,
    behaviorCriteria: [...getAllCriteria()],
    summary: {
      totalPersonas: results.length,
      passed: results.filter(r => r.passFail === 'PASS').length,
      failed: results.filter(r => r.passFail === 'FAIL').length,
      avgEnrichmentScore: avg(enrichmentScores),
      avgScheduleScore: avg(scheduleScores),
      avgConversationScore: avg(conversationScores),
      avgOverallScore: avg(overallScores),
      totalToolCalls,
      toolBreakdown,
    },
  };
}

function formatToolDetails(details: readonly ToolCallDetail[]): string {
  if (details.length === 0) return '';
  return details.map(td => {
    const resultPreview = td.result ? ` -> ${td.result.slice(0, 120)}${td.result.length > 120 ? '...' : ''}` : '';
    return `    TOOL: ${td.name}${resultPreview}`;
  }).join('\n');
}

function formatEnrichmentTurn(turn: EnrichmentTurn): string {
  const lines: string[] = [];
  lines.push(`**[Turn ${turn.turnNumber}] User:** ${turn.userMessage}`);
  lines.push('');
  lines.push(`**[Turn ${turn.turnNumber}] Glyde:** ${turn.agentResponse.slice(0, 400)}${turn.agentResponse.length > 400 ? '...' : ''}`);
  if (turn.toolDetails.length > 0) {
    lines.push('');
    lines.push('```');
    lines.push(formatToolDetails(turn.toolDetails));
    lines.push('```');
  }
  return lines.join('\n');
}

function formatConversationTurn(turn: ConversationTurn): string {
  const lines: string[] = [];
  lines.push(`**[${turn.scenarioId} | ${turn.category}] User:** ${turn.userMessage}`);
  lines.push('');
  lines.push(`**Glyde:** ${turn.agentResponse.slice(0, 400)}${turn.agentResponse.length > 400 ? '...' : ''}`);
  if (turn.toolDetails.length > 0) {
    lines.push('');
    lines.push('```');
    lines.push(formatToolDetails(turn.toolDetails));
    lines.push('```');
  }
  lines.push(`*(${turn.durationMs}ms)*`);
  return lines.join('\n');
}

function formatMarkdown(report: EvalReport): string {
  const lines: string[] = [];

  lines.push('# Onboarding-to-Schedule Pipeline Eval Report');
  lines.push('');
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push(`**Personas:** ${report.summary.totalPersonas}`);
  lines.push(`**Enrichment Turns:** ${report.config.enrichmentTurns}`);
  lines.push(`**Conversation Scenarios:** ${report.config.conversationEnabled ? 'enabled' : 'disabled'}`);
  lines.push(`**Judge Model:** ${report.config.judgeModel}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Passed | ${report.summary.passed}/${report.summary.totalPersonas} |`);
  lines.push(`| Failed | ${report.summary.failed}/${report.summary.totalPersonas} |`);
  lines.push(`| Avg Enrichment | ${report.summary.avgEnrichmentScore}/5 |`);
  lines.push(`| Avg Schedule | ${report.summary.avgScheduleScore}/5 |`);
  lines.push(`| Avg Conversation | ${report.summary.avgConversationScore}/5 |`);
  lines.push(`| Avg Overall | ${report.summary.avgOverallScore}/5 |`);
  lines.push(`| Total Tool Calls | ${report.summary.totalToolCalls} |`);
  lines.push(`| Passing Threshold | ${SCORE_THRESHOLDS.passingOverall}/5 |`);
  lines.push('');

  // Tool usage breakdown
  lines.push('## Tool Usage (all phases combined)');
  lines.push('');
  lines.push('| Tool | Count |');
  lines.push('|------|-------|');
  const sorted = Object.entries(report.summary.toolBreakdown).sort((a, b) => b[1] - a[1]);
  for (const [tool, count] of sorted) {
    lines.push(`| ${tool} | ${count} |`);
  }
  lines.push('');

  // Per-persona results table
  lines.push('## Per-Persona Results');
  lines.push('');
  lines.push('| Persona | Enrichment | Schedule | Conversation | Overall | Status |');
  lines.push('|---------|-----------|----------|-------------|---------|--------|');
  for (const r of report.results) {
    const overall = Math.round(
      ((r.enrichmentScore.overall + r.scheduleScore.overall + r.conversationScore.overall) / 3) * 100
    ) / 100;
    lines.push(`| ${r.characterId} | ${r.enrichmentScore.overall}/5 | ${r.scheduleScore.overall}/5 | ${r.conversationScore.overall}/5 | ${overall}/5 | ${r.passFail} |`);
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

    // Timing + tokens
    lines.push('### Timing and Token Usage');
    lines.push(`- Onboarding: ${pr.onboardingDurationMs}ms`);
    lines.push(`- Enrichment: ${Math.round(pr.enrichmentDurationMs / 1000)}s (${pr.enrichmentConversation.length} turns)`);
    lines.push(`- Scheduler: ${Math.round(pr.schedulerDurationMs / 1000)}s`);
    lines.push(`- Conversation: ${Math.round(pr.conversationDurationMs / 1000)}s (${pr.conversationTurns.length} scenarios)`);
    lines.push(`- Tokens: ${pr.tokenUsage.inputTokens.toLocaleString()} input / ${pr.tokenUsage.outputTokens.toLocaleString()} output / ${pr.tokenUsage.totalTokens.toLocaleString()} total`);
    lines.push(`- Model calls: ${pr.tokenUsage.modelCalls}`);
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

    // Conversation behavior scores
    lines.push('### Conversation Behavior Score');
    lines.push(`| Dimension | Score |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Tool Correctness | ${r.conversationScore.toolCorrectness}/5 |`);
    lines.push(`| Response Accuracy | ${r.conversationScore.responseAccuracy}/5 |`);
    lines.push(`| Duplicate Avoidance | ${r.conversationScore.duplicateAvoidance}/5 |`);
    lines.push(`| Context Awareness | ${r.conversationScore.contextAwareness}/5 |`);
    lines.push(`| **Overall** | **${r.conversationScore.overall}/5** |`);
    lines.push('');
    lines.push(`> ${r.conversationScore.reasoning}`);
    lines.push('');

    // Scenario pass/fail table
    const scenarioResults = r.conversationScore.scenarioResults;
    if (scenarioResults.length > 0) {
      lines.push('### Scenario Results');
      lines.push('');
      lines.push('| Scenario | Category | Status | Expected Tools | Actual Tools | Violations |');
      lines.push('|----------|----------|--------|---------------|-------------|------------|');
      for (const sr of scenarioResults) {
        const expected = sr.toolsExpected.join(', ') || '-';
        const actual = sr.toolsActual.join(', ') || '-';
        const violations = sr.violations.join('; ') || '-';
        lines.push(`| ${sr.scenarioId} | ${sr.category} | ${sr.passed ? 'PASS' : 'FAIL'} | ${expected} | ${actual} | ${violations} |`);
      }
      lines.push('');
    }

    // Full enrichment conversation with inline tool calls
    if (pr.enrichmentConversation.length > 0) {
      lines.push('### Enrichment Conversation (with tool calls)');
      lines.push('');
      for (const turn of pr.enrichmentConversation) {
        lines.push(formatEnrichmentTurn(turn));
        lines.push('');
      }
    }

    // Full conversation scenarios with inline tool calls
    if (pr.conversationTurns.length > 0) {
      lines.push('### Conversation Scenarios (with tool calls)');
      lines.push('');
      for (const turn of pr.conversationTurns) {
        lines.push(formatConversationTurn(turn));
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

  // Behavior criteria reference
  lines.push('## Behavior Criteria Reference');
  lines.push('');
  for (const c of report.behaviorCriteria) {
    lines.push(`- ${c}`);
  }
  lines.push('');

  // Failures section
  const failures = report.results.filter(r => r.passFail === 'FAIL');
  if (failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    for (const f of failures) {
      const overall = (f.enrichmentScore.overall + f.scheduleScore.overall + f.conversationScore.overall) / 3;
      lines.push(`### ${f.characterId} (${Math.round(overall * 100) / 100}/5)`);
      lines.push(`- Enrichment: ${f.enrichmentScore.reasoning}`);
      lines.push(`- Schedule: ${f.scheduleScore.reasoning}`);
      lines.push(`- Conversation: ${f.conversationScore.reasoning}`);

      const failedScenarios = f.conversationScore.scenarioResults.filter(s => !s.passed);
      if (failedScenarios.length > 0) {
        lines.push(`- Failed scenarios: ${failedScenarios.map(s => `${s.scenarioId} (${s.violations.join(', ')})`).join('; ')}`);
      }
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

  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const markdownPath = path.join(config.outputDir, `${baseName}.md`);
  const jsonPath = path.join(config.outputDir, `${baseName}.json`);

  fs.writeFileSync(markdownPath, formatMarkdown(report), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  return { markdownPath, jsonPath };
}
