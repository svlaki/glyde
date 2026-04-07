/**
 * LLM-as-judge scoring for the onboarding-to-schedule pipeline.
 * Uses a separate model from the pipeline agents to avoid self-eval bias.
 * Three rubrics: enrichment capture, schedule quality, conversation behavior.
 */

import OpenAI from 'openai';
import type {
  CharacterSheet,
  EnrichmentTurn,
  ConversationTurn,
  FinalState,
  EnrichmentScore,
  ScheduleScore,
  ConversationBehaviorScore,
  ScenarioResult,
  OnboardingScheduleEvalConfig,
} from './types.js';
import { BEHAVIOR_CRITERIA } from './behavior-criteria.js';

function formatConversation(turns: readonly EnrichmentTurn[]): string {
  return turns.map(t => {
    const toolLine = t.toolDetails.length > 0
      ? `Tools: ${t.toolDetails.map(td => `${td.name}${td.result ? ` -> ${td.result.slice(0, 100)}` : ''}`).join(' | ')}`
      : 'Tools: none';
    return `[Turn ${t.turnNumber}]\nUser: ${t.userMessage}\nGlyde: ${t.agentResponse}\n${toolLine}`;
  }).join('\n\n');
}

function formatConversationTurns(turns: readonly ConversationTurn[]): string {
  return turns.map(t => {
    const toolLine = t.toolDetails.length > 0
      ? `Tools: ${t.toolDetails.map(td => `${td.name}${td.result ? ` -> ${td.result.slice(0, 100)}` : ''}`).join(' | ')}`
      : 'Tools: none';
    return `[${t.scenarioId} | ${t.category}]\nUser: ${t.userMessage}\nGlyde: ${t.agentResponse}\n${toolLine}`;
  }).join('\n\n');
}

function formatFinalState(state: FinalState): string {
  const sections: string[] = [];

  sections.push(`ASPECTS (${state.aspects.length}):`);
  for (const a of state.aspects) {
    sections.push(`  - ${a.name} (color: ${a.color})${a.description ? `: ${a.description}` : ''}`);
  }

  sections.push(`\nRECURRING EVENTS (${state.recurringEvents.length}):`);
  for (const e of state.recurringEvents) {
    sections.push(`  - ${e.title} | ${e.start_time} - ${e.end_time}${e.rrule_string ? ` | rrule: ${e.rrule_string}` : ''}`);
  }

  sections.push(`\nONE-TIME EVENTS (${state.events.length}):`);
  for (const e of state.events) {
    sections.push(`  - ${e.title} | ${e.start_time} - ${e.end_time}`);
  }

  sections.push(`\nTASKS (${state.tasks.length}):`);
  for (const t of state.tasks) {
    sections.push(`  - ${t.title} (${t.status})`);
  }

  sections.push(`\nGOALS (${state.goals.length}):`);
  for (const g of state.goals) {
    sections.push(`  - ${g.title} (${g.status})`);
  }

  sections.push(`\nSUGGESTIONS (${state.suggestions.length}):`);
  for (const s of state.suggestions) {
    sections.push(`  - "${s.title}" (${s.suggestion_type}, ${s.estimated_minutes}min, energy: ${s.energy_level}) -- ${s.description || 'no description'}`);
  }

  sections.push(`\nPLACEMENT SLOTS (${state.placementSlots.length}):`);
  for (const s of state.placementSlots) {
    sections.push(`  - ${s.start_time} to ${s.end_time} (status: ${s.status})${s.reasoning ? ` -- ${s.reasoning}` : ''}`);
  }

  return sections.join('\n');
}

function formatExpectedOutcomes(character: CharacterSheet): string {
  const eo = character.expectedOutcomes;
  return [
    `Expected aspects: ${eo.expectedAspectNames.join(', ')}`,
    `Expected schedule patterns: ${eo.expectedSchedulePatterns.join(', ')}`,
    `Minimum: ${eo.minAspects} aspects, ${eo.minRecurringEvents} recurring events, ${eo.minGoals} goals`,
  ].join('\n');
}

function parseJsonScore<T>(raw: string, fallback: T): T {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) return fallback;

  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    return fallback;
  }
}

/**
 * Score the enrichment conversation quality.
 */
export async function judgeEnrichment(
  character: CharacterSheet,
  turns: readonly EnrichmentTurn[],
  finalState: FinalState,
  config: OnboardingScheduleEvalConfig,
): Promise<EnrichmentScore> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are evaluating an AI onboarding assistant. A fictional user with a known life profile went through an enrichment chat. Your job is to judge how well the assistant discovered and captured the user's life details.

CHARACTER PROFILE:
Name: ${character.name}
Occupation: ${character.onboardingData.occupation}
${character.onboardingData.fieldOfStudy ? `Field: ${character.onboardingData.fieldOfStudy}` : ''}

LIFE DETAILS THE CHARACTER HAD TO SHARE:
${character.enrichmentDetails.map((d, i) => `${i + 1}. ${d}`).join('\n')}

EXPECTED OUTCOMES:
${formatExpectedOutcomes(character)}

CORRECT BEHAVIOR CRITERIA:
${BEHAVIOR_CRITERIA.enrichment.map(c => `- ${c}`).join('\n')}

ANTI-PATTERNS TO CHECK FOR:
${BEHAVIOR_CRITERIA.antiPatterns.map(c => `- ${c}`).join('\n')}

CONVERSATION TRANSCRIPT (with tool calls):
${formatConversation(turns)}

RESULTING DATA (what the assistant actually created):
${formatFinalState(finalState)}

Score each dimension 1-5:

1. aspectDiscovery: Did the assistant discover and create aspects for all major life areas? (1=missed most, 5=found all)
2. scheduleCapture: Were recurring events created for the user's routines (classes, work shifts, gym, etc.)? (1=barely any, 5=comprehensive)
3. goalExtraction: Were the user's goals captured? (1=none, 5=all goals with good detail)
4. conversationQuality: Was the conversation natural and efficient? Did it avoid anti-patterns? (1=awkward/anti-patterns, 5=smooth and correct)
5. overall: Overall, would this user have a functional, populated calendar after this enrichment? (1=useless, 5=excellent)

Respond with ONLY a JSON object:
{
  "aspectDiscovery": <number>,
  "scheduleCapture": <number>,
  "goalExtraction": <number>,
  "conversationQuality": <number>,
  "overall": <number>,
  "reasoning": "<2-3 sentence explanation, mention any anti-patterns observed>"
}`;

  const response = await openai.chat.completions.create({
    model: config.judgeModel,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 500,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content || '';

  return parseJsonScore<EnrichmentScore>(raw, {
    aspectDiscovery: 1,
    scheduleCapture: 1,
    goalExtraction: 1,
    conversationQuality: 1,
    overall: 1,
    reasoning: 'Failed to parse judge response',
  });
}

/**
 * Score the scheduler output quality.
 */
export async function judgeSchedule(
  character: CharacterSheet,
  finalState: FinalState,
  config: OnboardingScheduleEvalConfig,
): Promise<ScheduleScore> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are evaluating an AI scheduling system. After onboarding and enrichment, a scheduler generated action suggestions and placed them into the user's calendar. Your job is to judge the quality of the resulting schedule.

CHARACTER PROFILE:
Name: ${character.name}
Occupation: ${character.onboardingData.occupation}
Goals: ${character.onboardingData.goals.join(', ')}

LIFE DETAILS:
${character.enrichmentDetails.map((d, i) => `${i + 1}. ${d}`).join('\n')}

EXPECTED SCHEDULE PATTERNS:
${character.expectedOutcomes.expectedSchedulePatterns.join(', ')}

CORRECT BEHAVIOR CRITERIA:
${BEHAVIOR_CRITERIA.scheduler.map(c => `- ${c}`).join('\n')}

RESULTING DATA:
${formatFinalState(finalState)}

Score each dimension 1-5:

1. suggestionRelevance: Are the suggestions directly tied to the user's actual goals, tasks, or aspects? (1=generic filler, 5=every suggestion references a real goal/task)
2. scheduleCompleteness: Does the resulting week look full and balanced? (1=mostly empty, 5=well-populated across the week)
3. timeSlotQuality: Are high-energy tasks placed in mornings/early afternoon? Are there reasonable gaps? No conflicts? (1=poor placement, 5=smart placement)
4. aspectBalance: Do the suggestions cover multiple life areas, not just one? (1=all one category, 5=good mix)
5. descriptionQuality: Do suggestion descriptions explain WHY this activity matters (referencing specific goals)? (1=vague/generic, 5=specific and motivating)
6. overall: Would this schedule actually help this person make progress on their goals? (1=useless, 5=excellent)

Respond with ONLY a JSON object:
{
  "suggestionRelevance": <number>,
  "scheduleCompleteness": <number>,
  "timeSlotQuality": <number>,
  "aspectBalance": <number>,
  "descriptionQuality": <number>,
  "overall": <number>,
  "reasoning": "<2-3 sentence explanation>"
}`;

  const response = await openai.chat.completions.create({
    model: config.judgeModel,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 500,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content || '';

  return parseJsonScore<ScheduleScore>(raw, {
    suggestionRelevance: 1,
    scheduleCompleteness: 1,
    timeSlotQuality: 1,
    aspectBalance: 1,
    descriptionQuality: 1,
    overall: 1,
    reasoning: 'Failed to parse judge response',
  });
}

/**
 * Deterministic per-scenario pass/fail check based on expected tool behavior.
 */
function evaluateScenarios(
  turns: readonly ConversationTurn[],
  character: CharacterSheet,
): ScenarioResult[] {
  return turns.map(turn => {
    const scenario = character.conversationScenarios.find(s => s.id === turn.scenarioId);
    if (!scenario) {
      return {
        scenarioId: turn.scenarioId,
        category: turn.category,
        passed: false,
        toolsExpected: [],
        toolsActual: [...turn.toolsCalled],
        violations: ['Scenario definition not found'],
      };
    }

    const violations: string[] = [];
    const expected = scenario.expectedBehavior;

    // Check required tools were called
    for (const tool of expected.shouldCallTools) {
      if (!turn.toolsCalled.includes(tool)) {
        violations.push(`Missing expected tool: ${tool}`);
      }
    }

    // Check forbidden tools were NOT called
    if (expected.shouldNotCallTools) {
      for (const tool of expected.shouldNotCallTools) {
        if (turn.toolsCalled.includes(tool)) {
          violations.push(`Called forbidden tool: ${tool}`);
        }
      }
    }

    return {
      scenarioId: turn.scenarioId,
      category: turn.category,
      passed: violations.length === 0,
      toolsExpected: [...expected.shouldCallTools],
      toolsActual: [...turn.toolsCalled],
      violations,
    };
  });
}

/**
 * Score the conversation agent behavior across all scenarios.
 * Combines deterministic tool checks with LLM quality judgment.
 */
export async function judgeConversation(
  character: CharacterSheet,
  turns: readonly ConversationTurn[],
  finalState: FinalState,
  config: OnboardingScheduleEvalConfig,
): Promise<ConversationBehaviorScore> {
  const scenarioResults = evaluateScenarios(turns, character);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are evaluating an AI life management assistant's behavior during a conversation. The user has already set up their account with a populated calendar, goals, and aspects. Now they are using the assistant for day-to-day tasks.

CHARACTER PROFILE:
Name: ${character.name}
Occupation: ${character.onboardingData.occupation}

CORRECT BEHAVIOR CRITERIA:
${BEHAVIOR_CRITERIA.conversation.map(c => `- ${c}`).join('\n')}

ANTI-PATTERNS:
${BEHAVIOR_CRITERIA.antiPatterns.map(c => `- ${c}`).join('\n')}

CURRENT CALENDAR/DATA STATE:
${formatFinalState(finalState)}

CONVERSATION SCENARIOS AND RESPONSES (with tool calls):
${formatConversationTurns(turns)}

DETERMINISTIC TOOL CHECK RESULTS:
${scenarioResults.map(r => `${r.scenarioId}: ${r.passed ? 'PASS' : 'FAIL'}${r.violations.length > 0 ? ` -- ${r.violations.join(', ')}` : ''}`).join('\n')}

Score each dimension 1-5:

1. toolCorrectness: Did the agent use the right tools for each request? Did it avoid unnecessary tools? (1=wrong tools frequently, 5=perfect tool selection)
2. responseAccuracy: Were the responses factually correct and relevant? Did they reference actual calendar data? (1=inaccurate, 5=precise and helpful)
3. duplicateAvoidance: Did the agent check for existing data before creating new entries? Did it avoid duplicates? (1=created duplicates, 5=always checked first)
4. contextAwareness: Was the agent aware of the user's schedule, goals, and existing data in its responses? (1=ignored context, 5=deeply context-aware)
5. overall: Overall, is this assistant behaving correctly and helpfully? (1=broken, 5=excellent)

Respond with ONLY a JSON object:
{
  "toolCorrectness": <number>,
  "responseAccuracy": <number>,
  "duplicateAvoidance": <number>,
  "contextAwareness": <number>,
  "overall": <number>,
  "reasoning": "<2-3 sentence explanation, mention specific anti-patterns if observed>"
}`;

  const response = await openai.chat.completions.create({
    model: config.judgeModel,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 500,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content || '';

  const scores = parseJsonScore<Omit<ConversationBehaviorScore, 'scenarioResults'>>(raw, {
    toolCorrectness: 1,
    responseAccuracy: 1,
    duplicateAvoidance: 1,
    contextAwareness: 1,
    overall: 1,
    reasoning: 'Failed to parse judge response',
  });

  return {
    ...scores,
    scenarioResults,
  };
}
