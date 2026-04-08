/**
 * Defines what "correct behavior" looks like for each phase of the pipeline.
 * These criteria are used by the judge and included in eval reports.
 *
 * Derived from real user patterns observed in production:
 * - Calendar is 90%+ of operations (create, update, delete)
 * - High event churn (deletions ~70% of creates) due to duplicates
 * - Suggestions have 65% dismissal rate, only 3% confirmed
 * - Tasks/goals are rarely used directly
 * - Users ask "what do I have today/tomorrow" frequently
 * - Friend sharing friction (agent needs UUID, user gives name)
 */

export const BEHAVIOR_CRITERIA = {
  enrichment: [
    'Agent must create aspects for each distinct life area mentioned (school, work, hobbies, health)',
    'Agent must create recurring events with correct days/times when user shares schedule details',
    'Agent must NOT create duplicate aspects or events for the same activity',
    'Agent must ask about ALL life areas (school/work, health, personal, daily routine) across the conversation',
    'Agent must call tools SILENTLY -- no narrating "I will now create an aspect for..."',
    'Agent must keep responses to 2-4 sentences, no markdown, no bullet points',
    'Agent must create aspect FIRST, then event using that aspect (correct sequencing)',
    'Agent must capture goals mentioned by user via create_goal tool',
    'Agent must update profile with occupation, work hours, preferences when shared',
    'Agent should cover all 5 areas within the turn budget (school, work, health, personal, routine)',
  ],

  conversation: [
    'Schedule queries ("what do I have today") must call list_events or search_events, not create anything',
    'Event creation must use the correct aspect for the activity type',
    'Event modification must search for the existing event first, then update it -- not create a new one',
    'Event deletion must confirm the right event before deleting (search first)',
    'Agent must NOT create duplicate events when one already exists at that time',
    'Agent must be aware of existing schedule when suggesting times ("do I have time for X")',
    'Task creation should use create_task, not create_event for non-time-bound items',
    'Goal check-ins should call list_goals or check_in_goal, not create new goals',
    'Responses must be concise and natural -- no markdown headers, no numbered lists unless asked',
    'Agent must not call unnecessary tools -- a simple greeting needs zero tool calls',
    'Agent must handle ambiguous time references correctly ("tomorrow", "next Monday", "this afternoon")',
    'When asked about free time, agent must call find_free_time and give specific windows',
  ],

  scheduler: [
    'Every suggestion must reference a specific goal, task, or aspect -- no generic filler',
    'Suggestion descriptions must explain WHY (reference the goal/task it advances)',
    'High-energy tasks (deep work, studying) must be placed in mornings/early afternoon',
    'Low-energy tasks (review, planning) must be placed in evenings',
    'No overlapping slots with existing events',
    'Minimum 60-minute duration for all slots',
    'Maximum 3-4 slots per day, spread across 7 days',
    'Multiple life areas must be represented (not all one aspect)',
    'Slots must have 30+ minute gaps between them and existing events',
  ],

  antiPatterns: [
    'DUPLICATE CREATION: Creating a second "CS 161 Lecture" when one already exists at MWF 10:30am',
    'TOOL NARRATION: "I will now create an aspect for your class" instead of just doing it',
    'GENERIC SUGGESTIONS: "Watch a TED talk" or "Go for a walk" with no goal connection',
    'OVER-TOOLING: Calling 5 tools when 1 would suffice',
    'UNDER-TOOLING: Responding to "add a meeting" with text instead of calling create_event',
    'WRONG TOOL: Using create_event for a task, or create_task for a scheduled meeting',
    'MARKDOWN IN CHAT: Using ## headers, **bold**, - bullet points in conversational responses',
    'IGNORING CONTEXT: Suggesting a meeting at 2pm when user has class then',
    'ASPECT ORPHANS: Creating events without linking to an aspect',
    'STALE RESPONSES: Not reflecting the current state of the calendar in answers',
  ],
} as const;

/**
 * Get all behavior criteria as a flat list for inclusion in reports.
 */
export function getAllCriteria(): readonly string[] {
  return [
    ...BEHAVIOR_CRITERIA.enrichment.map(c => `[Enrichment] ${c}`),
    ...BEHAVIOR_CRITERIA.conversation.map(c => `[Conversation] ${c}`),
    ...BEHAVIOR_CRITERIA.scheduler.map(c => `[Scheduler] ${c}`),
    ...BEHAVIOR_CRITERIA.antiPatterns.map(c => `[Anti-pattern] ${c}`),
  ];
}
