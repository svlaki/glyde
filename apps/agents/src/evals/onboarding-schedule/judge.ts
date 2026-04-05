/**
 * LLM-as-judge scoring for the onboarding-to-schedule pipeline.
 * Uses a separate model (gpt-4o) from the pipeline agents to avoid self-eval bias.
 * Two rubrics: enrichment capture and schedule quality.
 */

import OpenAI from 'openai';
import type {
  CharacterSheet,
  EnrichmentTurn,
  FinalState,
  EnrichmentScore,
  ScheduleScore,
  OnboardingScheduleEvalConfig,
} from './types.js';

function formatConversation(turns: readonly EnrichmentTurn[]): string {
  return turns.map(t =>
    `[Turn ${t.turnNumber}]\nUser: ${t.userMessage}\nGlyde: ${t.agentResponse}\nTools: ${t.toolsCalled.length > 0 ? t.toolsCalled.join(', ') : 'none'}`
  ).join('\n\n');
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
  // Extract JSON from markdown code blocks if present
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

CONVERSATION TRANSCRIPT:
${formatConversation(turns)}

RESULTING DATA (what the assistant actually created):
${formatFinalState(finalState)}

Score each dimension 1-5:

1. aspectDiscovery: Did the assistant discover and create aspects for all major life areas? (1=missed most, 5=found all)
2. scheduleCapture: Were recurring events created for the user's routines (classes, work shifts, gym, etc.)? (1=barely any, 5=comprehensive)
3. goalExtraction: Were the user's goals captured? (1=none, 5=all goals with good detail)
4. conversationQuality: Was the conversation natural and efficient? Did it cover all areas without being repetitive? (1=awkward/repetitive, 5=smooth and thorough)
5. overall: Overall, would this user have a functional, populated calendar after this enrichment? (1=useless, 5=excellent)

Respond with ONLY a JSON object:
{
  "aspectDiscovery": <number>,
  "scheduleCapture": <number>,
  "goalExtraction": <number>,
  "conversationQuality": <number>,
  "overall": <number>,
  "reasoning": "<2-3 sentence explanation>"
}`;

  const response = await openai.chat.completions.create({
    model: config.judgeModel,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
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
    max_tokens: 500,
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
