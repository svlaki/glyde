/**
 * Builds Gerald's prompt context from loaded user data.
 * Replicates the private context-building methods from InteractionAgentGerald.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { toDate } from 'date-fns';
import { buildGeraldSystemPrompt } from '../../agents/interaction-gerald/prompts.js';
import type { GeraldPromptContext } from '../../agents/interaction-gerald/prompts.js';
import type { LoadedUserData, GeneratedInteraction } from './types.js';

/**
 * Build the full GeraldPromptContext from loaded user data.
 * Optionally includes previously generated interactions in the recent history for dedup.
 */
export function buildEvalContext(
  userData: LoadedUserData,
  previousInteractions: readonly GeneratedInteraction[] = [],
): GeraldPromptContext {
  const timezone = userData.profile.timezone || 'UTC';
  const now = new Date();
  const todayFormatted = formatInTimeZone(now, timezone, 'MMMM d, yyyy');
  const todayDayName = formatInTimeZone(now, timezone, 'EEEE');
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowFormatted = formatInTimeZone(tomorrow, timezone, 'MMMM d, yyyy');
  const tomorrowDayName = formatInTimeZone(tomorrow, timezone, 'EEEE');
  const currentHour = parseInt(formatInTimeZone(now, timezone, 'H'), 10);

  // Merge real recent interactions with previously generated ones for dedup
  const mergedInteractions = mergeInteractionHistory(
    userData.recentInteractions,
    previousInteractions,
  );

  const rulesContext = buildRulesContext(userData.rules);

  return {
    timezone,
    eventContext: buildEventContext(userData.events as Record<string, any>[], timezone),
    taskContext: buildTaskContext(userData.tasks as Record<string, any>[], timezone),
    goalContext: buildGoalContext(userData.goals as Record<string, any>[], timezone),
    profileContext: buildProfileContext(userData.profile),
    aspectContext: buildAspectContext(userData.aspects as Record<string, any>[]),
    todayDayName,
    todayFormatted,
    tomorrowFormatted,
    tomorrowDayName,
    currentHour,
    toolCount: 55,
    rulesContext: rulesContext || undefined,
    recentInteractionContext: buildRecentInteractionContext(mergedInteractions),
    ratingContext: buildRatingContext(userData.ratingSummary as any[]),
    recentActivityContext: buildRecentActivityContext(userData.recentPastEvents as Record<string, any>[], timezone),
  };
}

/**
 * Build the system message from the context.
 */
export function buildEvalSystemPrompt(
  userData: LoadedUserData,
  previousInteractions: readonly GeneratedInteraction[] = [],
) {
  const context = buildEvalContext(userData, previousInteractions);
  return buildGeraldSystemPrompt(context);
}

// -- Context builders (replicating InteractionAgentGerald private methods) --

function buildEventContext(events: Record<string, any>[], timezone: string): string {
  if (!events || events.length === 0) {
    return '\nCALENDAR: No upcoming events scheduled.';
  }

  const eventLines = events.slice(0, 15).map((e) => {
    const startDate = toDate(e.start_time);
    const endDate = toDate(e.end_time);
    const dateStr = formatInTimeZone(startDate, timezone, 'EEE, MMM d');
    const startTime = formatInTimeZone(startDate, timezone, 'h:mm a');
    const endTime = formatInTimeZone(endDate, timezone, 'h:mm a');
    const categoryInfo = e.category_name
      ? ` [${e.category_name}${e.category_id ? `, catId: ${e.category_id}` : ''}]`
      : '';
    const location = e.location ? ` @ ${e.location}` : '';
    return `  - "${e.title}" on ${dateStr} from ${startTime} to ${endTime}${categoryInfo}${location}`;
  });

  return `\nCALENDAR (${events.length} upcoming events):\n${eventLines.join('\n')}`;
}

function buildTaskContext(tasks: Record<string, any>[], timezone: string): string {
  if (!tasks || tasks.length === 0) {
    return '\nTASKS: No active tasks.';
  }

  const taskLines = tasks.slice(0, 10).map((t, idx) => {
    const dueStr = t.due_date
      ? ` (Due: ${formatInTimeZone(toDate(t.due_date), timezone, 'MMM d')})`
      : '';
    const priorityStr = t.priority ? ` [${t.priority.toUpperCase()}]` : '';
    const categoryInfo = t.category_name
      ? ` [${t.category_name}${t.category_id ? `, catId: ${t.category_id}` : ''}]`
      : '';
    const statusStr = t.status === 'in_progress' ? ' (in progress)' : '';
    const desc = t.description ? ` - ${t.description.substring(0, 50)}...` : '';
    return `  ${idx + 1}. ${t.title}${priorityStr}${statusStr}${dueStr}${categoryInfo}${desc}`;
  });

  return `\nTASKS (${tasks.length} active):\n${taskLines.join('\n')}`;
}

function buildGoalContext(goals: Record<string, any>[], timezone: string): string {
  if (!goals || goals.length === 0) {
    return '\nGOALS: No active goals.';
  }

  const goalLines = goals.slice(0, 8).map((g) => {
    const progress = g.progress != null ? ` (${g.progress}% complete)` : '';
    const targetStr = g.target_date
      ? ` - Target: ${formatInTimeZone(toDate(g.target_date), timezone, 'MMM d, yyyy')}`
      : '';
    const categoryInfo = g.category_name
      ? ` [${g.category_name}${g.category_id ? `, catId: ${g.category_id}` : ''}]`
      : '';
    const desc = g.description ? `\n      ${g.description.substring(0, 100)}` : '';
    return `  - "${g.title}"${progress}${targetStr}${categoryInfo}${desc}`;
  });

  return `\nGOALS (${goals.length} active):\n${goalLines.join('\n')}`;
}

function buildProfileContext(profile: Record<string, any>): string {
  if (!profile) {
    return '\nPROFILE: Not available.';
  }

  const parts: string[] = [];
  const name = profile.preferred_name || profile.display_name || profile.email?.split('@')[0] || 'User';
  parts.push(`Name: ${name}`);

  if (profile.occupation) {
    const occ = profile.field_of_study
      ? `${profile.occupation} (${profile.field_of_study})`
      : profile.occupation;
    parts.push(`Occupation: ${occ}`);
  }

  const aspects = profile.context_data?.life_aspects;
  if (aspects?.length) {
    parts.push(`Life focus areas: ${aspects.join(', ')}`);
  }

  if (profile.goals_summary) {
    parts.push(`Goals: ${profile.goals_summary}`);
  }

  return `\nPROFILE:\n  ${parts.join('\n  ')}`;
}

function buildAspectContext(aspects: Record<string, any>[]): string {
  if (!aspects || aspects.length === 0) {
    return '\nASPECTS: Using defaults (no aspectId needed).';
  }

  const aspectList = aspects.map(a => {
    const desc = a.description ? ` - ${a.description.substring(0, 40)}` : '';
    return `  - "${a.name}" (ID: ${a.id})${desc}`;
  }).join('\n');

  return `\nASPECTS (${aspects.length}) - Use these IDs when creating events/tasks/goals:\n${aspectList}`;
}

function buildRecentInteractionContext(interactions: Record<string, any>[]): string {
  if (!interactions || interactions.length === 0) {
    return '\nRECENT INTERACTION HISTORY: No recent interactions.';
  }

  const lines = interactions.slice(0, 20).map(i => {
    const status = i.status === 'responded' ? 'responded'
      : i.status === 'dismissed' || i.status === 'expired' || i.status === 'cancelled' ? 'DISMISSED'
      : i.status === 'pending' || i.status === 'active' ? 'still pending'
      : i.status;
    const type = i.interaction_type || 'unknown';
    const age = i.created_at ? `${Math.round((Date.now() - new Date(i.created_at).getTime()) / 3600000)}h ago` : '';
    const responseText = i.interaction_responses?.[0]?.response;
    const responseSuffix = responseText ? ` [user answered: "${responseText}"]` : '';
    let responseTimeSuffix = '';
    if (i.status === 'responded' && i.created_at && i.interaction_responses?.[0]?.responded_at) {
      const createdMs = new Date(i.created_at).getTime();
      const respondedMs = new Date(i.interaction_responses[0].responded_at).getTime();
      const diffMin = Math.round((respondedMs - createdMs) / 60000);
      responseTimeSuffix = diffMin < 60
        ? ` [responded in ${diffMin}min]`
        : ` [responded in ${Math.round(diffMin / 60 * 10) / 10}h]`;
    }
    return `  - [${type}] "${i.question}" -> ${status} (${age})${responseSuffix}${responseTimeSuffix}`;
  });

  const dismissedTopics = interactions
    .filter(i => ['dismissed', 'expired', 'cancelled'].includes(i.status))
    .map(i => i.question)
    .slice(0, 10);

  const dismissedSection = dismissedTopics.length > 0
    ? `\nDISMISSED TOPICS (NEVER revisit these in any form):\n${dismissedTopics.map(q => `  - "${q}"`).join('\n')}`
    : '';

  return `\nRECENT INTERACTION HISTORY (last ${interactions.length}, newest first):
${lines.join('\n')}
${dismissedSection}
DEDUPLICATION RULES (CRITICAL):
- EVERY question above has ALREADY been asked. Do NOT rephrase or re-ask ANY of them.
- Topics that were DISMISSED must NEVER be brought up again in ANY form.
- If you already asked about exercise, do NOT ask about workouts, gym, fitness, etc.
- If you already asked about studying, do NOT ask about focus time, homework, review, etc.
- Generate COMPLETELY NEW topics not covered above.
- Use DIFFERENT interaction types than the last 3 interactions.
- Vary the CATEGORY (scheduling vs reflection vs check-in vs progress).`;
}

function buildRatingContext(ratingSummary: any[]): string {
  if (!ratingSummary || ratingSummary.length === 0) {
    return '\nRATING TRACKER: No ratings yet. Consider creating rating check-ins for areas the user cares about.';
  }

  const lines = ratingSummary.map(r => {
    const trendIcon = r.trend > 0 ? '(improving)' : r.trend < 0 ? '(declining)' : '(stable)';
    const lastAskedDate = new Date(r.lastAsked);
    const daysSince = Math.round((Date.now() - lastAskedDate.getTime()) / 86400000);
    const timeAgo = daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;
    return `  - "${r.topic}": ${r.latestScore}/10 ${trendIcon} (last asked: ${timeAgo}, ${r.totalEntries} entries)`;
  });

  return `\nRATING TRACKER (user's self-assessment scores):
${lines.join('\n')}
RATING RULES:
- For ratings that are LOW (1-4): suggest actions to improve that area before re-asking
- For ratings that are HIGH (8-10): acknowledge and focus on maintaining
- For DECLINING ratings: prioritize addressing what's causing the drop
- MINIMUM 5 DAYS between re-asking the same rating topic. Check "last asked" above - if less than 5 days ago, DO NOT ask about that topic in ANY form
- When asking a rating, ask about the past 5 days (e.g., "How would you rate X over the past 5 days?")
- When creating a rating interaction, include metadata.ratingTopic with the EXACT same topic name used before
- Use interaction type "rating" with options ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
- NEVER create multiple rating interactions about the same topic or related topics in one batch`;
}

function buildRecentActivityContext(pastEvents: Record<string, any>[], timezone: string): string {
  if (!pastEvents || pastEvents.length === 0) {
    return '';
  }

  const sorted = [...pastEvents].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  const eventLines = sorted.slice(0, 20).map((e) => {
    const startDate = toDate(e.start_time);
    const dateStr = formatInTimeZone(startDate, timezone, 'EEE, MMM d');
    const startTime = formatInTimeZone(startDate, timezone, 'h:mm a');
    const categoryInfo = e.category_name ? ` [${e.category_name}]` : '';
    return `  - "${e.title}" on ${dateStr} at ${startTime}${categoryInfo}`;
  });

  return `\nRECENT ACTIVITY (past 7 days - use to understand user's patterns and habits):
${eventLines.join('\n')}
Use this to suggest interactions that fit the user's actual routine and lifestyle patterns.`;
}

function buildRulesContext(rules: readonly Record<string, any>[]): string | null {
  if (!rules || rules.length === 0) return null;
  return rules.map(r => `- ${r.rule_text || r.content || r.title}`).join('\n');
}

/**
 * Merge real DB interactions with previously generated eval interactions
 * so Gerald's prompt includes the full history for dedup.
 */
function mergeInteractionHistory(
  realInteractions: readonly Record<string, any>[],
  generated: readonly GeneratedInteraction[],
): Record<string, any>[] {
  const synthetic = generated.map(g => ({
    question: g.question,
    interaction_type: g.type,
    status: 'pending',
    created_at: new Date().toISOString(),
    options: g.options,
    interaction_responses: [],
  }));

  return [...synthetic, ...(realInteractions as Record<string, any>[])];
}
