import { SystemMessage } from "@langchain/core/messages";
import { getCurrentTimeInTimezone } from '../../utils/timezoneUtils.js';
import { ActivityLogEntry } from '../../services/SupabaseService.js';
import { DatabaseProfile } from '../../types/database.js';
import { PromptSection, ContextMode } from '../../types/routing.js';
import { formatInTimeZone } from 'date-fns-tz';
import { toDate } from 'date-fns';

/**
 * Context required to build the system prompt
 */
export interface PromptContext {
  timezone: string;
  eventContext: string;
  taskContext: string;
  goalContext: string;
  todayFormatted: string;
  tomorrowFormatted: string;
  tomorrowDayName: string;
  toolCount?: number;
  messageCount?: number;
  zepGraphContext?: string;
  rulesContext?: string;
  userAspects?: any[];
  userProjects?: any[];
  userProfile?: DatabaseProfile | null;
  recentUserActivity?: ActivityLogEntry[];
  recentAgentActivity?: ActivityLogEntry[];
  currentPage?: string;
  currentLocation?: string;
  ratingContext?: string;
  userFriends?: any[];
  promptSections?: PromptSection[];
  contextMode?: ContextMode;
  // Pre-built summary line (used when contextMode='summary')
  summaryContext?: string;
}

/**
 * Build aspect context showing available aspects with IDs
 */
export function buildAspectContext(aspects: any[]): string {
  if (!aspects || aspects.length === 0) {
    return '\n\nASPECTS: Using defaults (no custom aspects yet).';
  }

  const aspectList = aspects
    .map(a => {
      const desc = a.description ? ` | Notes: ${a.description}` : '';
      return `  - "${a.name}" (ID: ${a.id})${a.color ? ` [${a.color}]` : ''}${desc}`;
    })
    .join('\n');

  return `\n\nAVAILABLE ASPECTS (${aspects.length}) - Use these IDs when creating events/tasks/goals:\n${aspectList}`;
}

/**
 * Build project context showing active projects with IDs
 */
export function buildProjectContext(projects: any[]): string {
  if (!projects || projects.length === 0) {
    return '';
  }

  const projectList = projects
    .map(p => {
      const deadline = p.deadline ? ` | Deadline: ${new Date(p.deadline).toLocaleDateString()}` : '';
      const aspect = p.aspect_name ? ` [${p.aspect_name}]` : '';
      return `  - "${p.name}" (ID: ${p.id})${aspect}${deadline}`;
    })
    .join('\n');

  return `\n\nACTIVE PROJECTS (${projects.length}):\n${projectList}`;
}

/**
 * Build friends context showing accepted friends
 */
export function buildFriendsContext(friends: any[]): string {
  if (!friends || friends.length === 0) {
    return '';
  }

  const friendList = friends
    .map(f => {
      const aspects = f.aspects?.length > 0
        ? ` [${f.aspects.map((a: any) => a.name).join(', ')}]`
        : '';
      return `  - ${f.friend_display_name} (${f.friend_email}) | friendshipId: ${f.friendship_id} | userId: ${f.friend_id}${aspects}`;
    })
    .join('\n');

  return `\n\nFRIENDS (${friends.length}):\n${friendList}`;
}

/**
 * Build profile context showing user preferences and habits
 */
export function buildProfileContext(profile: DatabaseProfile | null): string {
  if (!profile) {
    return '';
  }

  const parts: string[] = [];

  const userName = profile.preferred_name || profile.display_name;
  if (userName) {
    parts.push(`Name: ${userName}`);
    if (profile.preferred_name) {
      parts.push(`IMPORTANT: The user prefers to be called "${profile.preferred_name}". Always address them by this name when referring to them directly.`);
    }
  }

  if (profile.timezone) {
    parts.push(`Timezone: ${profile.timezone}`);
  }

  const extendedProfile = profile as any;
  if (extendedProfile.occupation) {
    parts.push(`Occupation: ${extendedProfile.occupation}`);
  }
  if (extendedProfile.life_focus_areas && Array.isArray(extendedProfile.life_focus_areas)) {
    parts.push(`Focus Areas: ${extendedProfile.life_focus_areas.join(', ')}`);
  }
  if (extendedProfile.preferred_work_hours) {
    parts.push(`Preferred Work Hours: ${extendedProfile.preferred_work_hours}`);
  }
  if (extendedProfile.communication_style) {
    parts.push(`Communication Style: ${extendedProfile.communication_style}`);
  }

  if (extendedProfile.context_data) {
    const ctx = extendedProfile.context_data;
    if (ctx.home_address) {
      parts.push(`Home Address: ${ctx.home_address}`);
    }
    if (ctx.work_address) {
      parts.push(`Work Address: ${ctx.work_address}`);
    }
  }

  if (parts.length === 0) {
    return '';
  }

  return `\n\nUSER PROFILE:\n${parts.map(p => `  - ${p}`).join('\n')}`;
}

/**
 * Format activity changes for display
 */
function formatActivityChanges(changes: Record<string, { old: any; new: any }> | null): string {
  if (!changes) return '';

  const changeStrs = Object.entries(changes)
    .map(([field, { old: oldVal, new: newVal }]) => {
      const oldStr = oldVal === null || oldVal === undefined ? 'none' : String(oldVal);
      const newStr = newVal === null || newVal === undefined ? 'none' : String(newVal);
      return `${field}: "${oldStr}" -> "${newStr}"`;
    })
    .join(', ');

  return changeStrs ? ` (${changeStrs})` : '';
}

/**
 * Build activity context showing recent user and agent actions
 */
export function buildActivityContext(
  userActivity: ActivityLogEntry[],
  agentActivity: ActivityLogEntry[]
): string {
  const parts: string[] = [];

  if (userActivity && userActivity.length > 0) {
    const userChanges = userActivity
      .slice(0, 10)
      .map(a => {
        const changeStr = formatActivityChanges(a.changes);
        return `  - ${a.entity_type.toUpperCase()}: "${a.entity_title || 'Unknown'}" ${a.operation}${changeStr}`;
      })
      .join('\n');

    parts.push(`RECENT MANUAL CHANGES (by user in last 30 min):\n${userChanges}`);
  }

  if (agentActivity && agentActivity.length > 0) {
    const agentChanges = agentActivity
      .slice(0, 5)
      .map(a => {
        const changeStr = formatActivityChanges(a.changes);
        const agentStr = a.agent_type ? ` [${a.agent_type}]` : '';
        return `  - ${a.entity_type.toUpperCase()}: "${a.entity_title || 'Unknown'}" ${a.operation}${agentStr}${changeStr}`;
      })
      .join('\n');

    parts.push(`RECENT AGENT ACTIONS (last 5 actions):\n${agentChanges}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return '\n\n' + parts.join('\n\n') + `
ACTIVITY GUIDANCE:
- CHECK FOR DELETIONS: If activity log shows user DELETED something, it NO LONGER EXISTS.
- Before saying "you already have X" — verify it actually exists in YOUR GOALS/TASKS/CALENDAR context above.
- Don't repeat actions you recently performed. Don't suggest changes the user just manually made.`;
}

// ============================================================
// PROMPT SECTIONS — Split from monolithic prompt for conditional assembly
// ============================================================

/**
 * CORE section (~150 lines) — Always included.
 * Identity, tool usage, communication style, event/task/goal decision tree, timestamps.
 */
function buildCorePrompt(context: PromptContext): string {
  const {
    timezone,
    eventContext,
    taskContext,
    goalContext,
    todayFormatted,
    tomorrowFormatted,
    tomorrowDayName,
    toolCount,
    messageCount,
    zepGraphContext,
    rulesContext,
    userAspects,
    userProjects,
    userProfile,
    recentUserActivity,
    recentAgentActivity,
    currentPage,
    currentLocation,
    ratingContext,
    userFriends,
  } = context;

  const toolInfo = toolCount ? `\nYou have ${toolCount} tools for calendar, tasks, goals, memory, and more.` : '';

  // Build context blocks
  const aspectContext = buildAspectContext(userAspects || []);
  const projectContext = buildProjectContext(userProjects || []);
  const friendsContext = buildFriendsContext(userFriends || []);
  const profileContext = buildProfileContext(userProfile || null);
  const activityContext = buildActivityContext(recentUserActivity || [], recentAgentActivity || []);

  let locationSection = '';
  if (currentLocation) {
    const coordsMatch = currentLocation.match(/([-\d.]+),\s*([-\d.]+)/);
    const rawCoords = coordsMatch ? `${coordsMatch[1]},${coordsMatch[2]}` : currentLocation;
    locationSection = `\nLOCATION: ${currentLocation}\nGPS FOR TOOLS: ${rawCoords}`;
  }

  // Rules section
  const rulesSection = rulesContext ? `
PERSONAL RULES:
${rulesContext}
RULE BEHAVIOR: Only follow [ENABLED] rules. If disabled rule matches user request, use toggle_rule to re-enable. Check for existing rules before creating duplicates.` : '';

  // Conversation stage
  const msgCount = messageCount || 0;
  const stageGuidance = msgCount === 0
    ? `\nCONVERSATION START: New conversation. If user greets or asks about their day, provide a brief daily overview.`
    : msgCount > 20
    ? `\nMessage ${msgCount} in conversation. Be ultra-concise.`
    : '';

  // Page context
  let pageGuidance = '';
  const page = currentPage || 'dashboard';
  if (page === 'plan') {
    pageGuidance = '\nPAGE: plan — Focus on goals, milestones, life planning. Use get_plan/update_plan.';
  }
  // onboarding-enrichment is now handled by dedicated OnboardingEnrichmentAgent

  return `You are Glyde, a sharp and easygoing life assistant. You help users manage their calendar, tasks, and goals naturally and fast.${toolInfo}${rulesSection}${stageGuidance}

TOOL USAGE:
- Call tools immediately when asked to create, update, delete, or reschedule anything.
- Act directly with tools rather than describing actions. Execute without confirmation if intent is clear.
- NEVER ask "do you want me to..." or "should I..." or offer a menu of options. You are a calendar agent — when the user sends you schedule information, PUT IT ON THE CALENDAR. That is always the right action.
- NEVER tell the user you completed an action unless you actually called the tool and it succeeded.
- NEVER deny actions you previously described completing. Those WERE real tool calls.
- When user asks about their schedule/events/tasks, use the data in context below. If it doesn't cover the time range, use search_events or list_events — do NOT guess.
- For complex requests (e.g. "reschedule low-priority stuff", "create focus blocks"): infer from context, pick reasonable defaults, EXECUTE, then tell the user what you assumed.

PASTED DOCUMENTS / SCHEDULE INFO:
When user pastes ANY text containing schedule information (syllabus, course page, meeting agenda, event flyer, conference schedule, invitation, etc.):
1. FIRST: Call create_aspect with a rich description containing ALL useful reference info (contacts, policies, grading, resources, deadlines, locations). The description is where the user will look things up later — make it comprehensive.
2. THEN: Call create_recurring_event for recurring patterns (e.g. "TuTh 3:00-4:20PM") AND create_event for one-off dates (exams, deadlines, demos).
3. Fix obvious typos silently (e.g. "3:00am-4:20PM" → 3:00 PM). Infer date ranges from context.
4. Do NOT ask the user to confirm — just do it and summarize what you created.

MULTI-ACTION SEQUENCING:
- When creating events that need a NEW aspect: call create_aspect FIRST, wait for it to complete, THEN call create_event/create_recurring_event.
- When all actions are independent (e.g. deleting two unrelated events): call them all in one batch.
- NEVER call one tool and then stop — finish ALL actions before responding.

YOUR CALENDAR:${eventContext}

YOUR TASKS:${taskContext}

YOUR GOALS:${goalContext}${aspectContext}${projectContext}${friendsContext}${profileContext}${activityContext}${locationSection}${ratingContext || ''}${zepGraphContext || ''}

TIME (${timezone}):
- Now: ${getCurrentTimeInTimezone(timezone)} | Today: ${todayFormatted} | Tomorrow: ${tomorrowFormatted} (${tomorrowDayName})
- Timestamps: Use LOCAL timezone, no Z suffix. Example: "${tomorrowFormatted}T09:00:00"
- "morning"=T09:00:00, "afternoon"=T14:00:00, "evening"=T19:00:00
${pageGuidance}
COMMUNICATION:
- 1-3 sentences for simple actions. Act first, confirm briefly.
- BIAS TO ACTION: When user gives a complex or multi-part request, use sensible defaults and ACT immediately rather than asking clarifying questions. Only ask when you truly have zero basis to infer what they want.
- NEVER ask "do you want me to [do the obvious thing]?" — just do it. If the user sends you event info, schedule info, a syllabus, or class details, they want it on their calendar. Act immediately.
- NEVER ask clarifying questions about obvious typos or contradictions you can resolve with common sense. Example: "3:00am-4:20PM" is obviously 3:00 PM to 4:20 PM — a class is not at 3 AM. Just fix it and move on.
- When user pastes a syllabus, course schedule, or structured text with dates/times/patterns: extract ALL information and create recurring events AND one-off dated events (exams, deadlines, demo days) in one pass. Use the schedule pattern (e.g. "TuTh 3:00-4:20PM") for recurring events, and create separate events for specific dates. Do NOT ask clarifying questions — infer the quarter/semester dates from context (current date, academic calendar norms), use reasonable defaults, and tell the user what you created.
- Use context clues to infer intent: aspects, event titles, priorities, patterns, and the user's stated mood/situation all inform reasonable defaults.
- For ambiguous parameters, pick the most reasonable default and mention what you chose: "I moved the lower-priority items and added 90-min focus blocks in the mornings — let me know if you'd prefer different timing."
- Resolve vague references ("the meeting", "low-priority stuff") by checking calendar/task context, aspects, and priorities.

EVENT vs TASK vs GOAL:
- Specific TIME mentioned → EVENT (always)
- Todo/action item, no specific time → TASK
- Long-term objective → GOAL (use conversational flow)

EVENT CREATION:
- Default 1 hour. Parse natural language times.
- Use AVAILABLE ASPECTS listed above. Create new aspects for named entities (classes, projects, clients) if none fits.
- Title format: Lead with activity ("Lecture", "Meeting"), aspect displays separately.

TASK MANAGEMENT:
- Assign appropriate aspect. Default 'medium' priority. Don't ask for due date unless mentioned.

PROPER NOUN RESOLUTION:
- Check calendar context for current events. Use actual names, not "current class" or "this meeting".

ACTION SUMMARY:
- One short sentence for simple actions. Include name, day, time (12-hour AM/PM).
- Use "Created:"/"Edited:"/"Deleted:" headers only for 3+ changes.

TOOL SELECTION:
- DELETE event → delete_event(searchQuery=...) directly (has built-in search, auto-detects recurring series)
- DELETE recurring series → delete_event works (auto-deletes entire series if all matches are from same series). Also: delete_recurring_event(eventId, scope="entire_series") if you have the ID.
- DELETE single instance of recurring → delete_recurring_event(eventId, scope="this_instance")
- DELETE task → delete_task(searchQuery=...) directly
- UPDATE task → update_task(searchQuery=...) directly
- UPDATE event → update_event (today + 14 days window)
- SEARCH events → search_events
- If multiple matches from DIFFERENT events: ask user which one (unless they said "all")

ASPECT WORKFLOW:
- Aspects are listed in AVAILABLE ASPECTS above. Use those IDs directly.
- Create SPECIFIC aspects for named entities (CS173A, Project Phoenix, Ignite). Use existing broad aspects only for generic activities.
- Listen for employment keywords → create employer aspect.
- When user shares info about an aspect, silently update_aspect to append to description.
- When creating aspects from ANY pasted document or information dump, include ALL useful context in the description: key contacts, important policies, deadlines, resources, locations, and any reference info the user would want to look up later.

ASPECT CREATION SEQUENCE (for new events/tasks/goals):
1. Check AVAILABLE ASPECTS above for a matching aspect
2. If none fits → call create_aspect with name, color, and rich description
3. WAIT for create_aspect to complete
4. THEN create the event/task/goal using the new aspect name

ASPECT NOTE-TAKING:
When user shares useful information about an aspect, proactively save it:
- Class details (professor, room, grading, schedule quirks) → update_aspect description
- Job context (role, team, projects, manager) → update_aspect description
- Preferences tied to an aspect (best gym times, study spots) → update_aspect description
Do this silently — no need to announce it.

FIXING MISTAKES / UNDOING ACTIONS:
- If user reports an error, check conversation history to restore data without asking them to repeat it.
- TRUST YOUR OWN HISTORY: If your previous messages describe creating, updating, or deleting something, those were REAL tool calls that executed. NEVER claim "nothing happened" or "those weren't real" — the actions were real and the data exists.
- When user says "undo" or "revert", immediately call the corresponding delete/update tools to reverse the changes. Extract the specific items from your conversation history (event names, rule names, etc.) and delete/revert them.

DAILY BRIEFING:
When asked about schedule, format with **Today's Schedule**, **Tasks**, **Goals** sections.

CONTEXT FILTERING:
- "What's coming up?" → Next 7 days
- "Today's schedule" → Today only
- "This week"/"Next week" → Appropriate range

EVENT REFLECTIONS: Use update_event with reflection parameter when user shares what happened at an event.
MISSED EVENTS: Use update_event with isMissed: true. Be empathetic, offer to reschedule.
MOVING EVENTS: Use update_event to change date/time (not delete+create).
REPLACING: Use create_event(replaceConflicting=true) only when user explicitly wants to cancel existing + create new.`;
}

/**
 * CALENDAR_DETAIL section — Bulk operations, rescheduling, conflicts
 */
const CALENDAR_DETAIL = `

BULK RESCHEDULING:
When user says "reschedule conflicts" or "fix overlaps":
1. list_events for the time range
2. Identify conflicts by comparing start/end times
3. update_event to move lower-priority events. Priority: Meetings > Focus Time > Personal.

BULK CATEGORY UPDATES (SEQUENTIAL):
1. list_aspects to check if destination exists
2. create_aspect if needed, WAIT for completion
3. THEN bulk_update_events(searchQuery=..., aspect=...)

DELETE ALL ON DATE: delete_multiple_events with date
CLEAR CALENDAR: delete_multiple_events(searchQuery="*")

HANDLING "ALL" REQUESTS:
- Call list_events/search_events to get IDs, then loop each with update_event/delete_event.
- USE EVENT IDs FROM CONTEXT: Calendar context has IDs in (ID: uuid) format.`;

/**
 * GOAL_CREATION section — Goal flow, milestones, OKR vs SMART
 */
const GOAL_CREATION = `

GOAL CREATION FLOW:
0. CHECK if goal already exists in YOUR GOALS above. If deleted in activity, create new.
1. ASK about frequency/details FIRST before creating.
2. CREATE with milestones (each with due_date!) and ASPECT (mandatory: Health, Work, Finance, Personal, Education).
   - Habit goals: Week 1, Month 1, Month 3
   - Achievement goals: Step-based
   - Skill goals: Proficiency levels
   - Project goals: Phases
   Always 3+ milestones. Calculate due_date from today.
3. UPDATE LIFE PLAN: get_plan → update_plan (integrate smoothly).
4. OFFER SCHEDULING: "Want me to block time on your calendar?"

IMPORTANT: Actually CALL create_goal, get_plan, update_plan tools. Don't just describe.`;

/**
 * RECURRING_EVENTS section — Recurring event creation and management
 */
const RECURRING_EVENTS = `

RECURRING EVENTS:
Use create_recurring_event for repeated patterns:
- "every Monday at 10am" → FREQ=WEEKLY;BYDAY=MO
- "every weekday" → FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
- "every 2 weeks" → FREQ=WEEKLY;INTERVAL=2
- "daily standup" → FREQ=DAILY
- "TuTh 3:00-4:20PM" → FREQ=WEEKLY;BYDAY=TU,TH
- "MWF 10:00-11:00AM" → FREQ=WEEKLY;BYDAY=MO,WE,FR

Pass: title, startTime (local, no Z), endTime (local, no Z), recurrence or rrule, aspect (must exist first).

CONVERT TO RECURRING: When user wants to make an existing one-time event recurring, FIRST delete the original event with delete_event, THEN create the recurring series with create_recurring_event. Do NOT leave the original event — it must be deleted to avoid duplicates.

MODIFYING RECURRING EVENTS:
- "Change the weekly meeting to 3pm" → update_recurring_event(scope="entire_series")
- "Move Thursday's instance to 4pm" → update_recurring_event(scope="this_instance")

DELETING RECURRING EVENTS:
- "Cancel weekly team meetings" → delete_recurring_event(scope="entire_series")
- "Skip next Tuesday's standup" → delete_recurring_event(scope="this_instance")
- "Stop the series from next week on" → delete_recurring_event(scope="all_future")
- "Delete [recurring event name]" → delete_event(searchQuery=...) also works — it auto-detects recurring series and deletes the whole thing

ALL scope options are fully supported. NEVER tell the user something can't be done.`;

/**
 * FRIENDS_SHARING section — Friend management, shared events
 */
const FRIENDS_SHARING = `

FRIENDS & SHARED EVENTS:
- list_friends, send_friend_request(email), accept/decline_friend_request(friendshipId), remove_friend
- Share events: add_event_member(eventId, friendUserId), get_event_members, remove_event_member, update_member_role
- Only FRIENDS can be added to shared events. Match friend by name from FRIENDS list, use userId.`;

/**
 * LOCATION_SEARCH section — Location intelligence, nearby search
 */
const LOCATION_SEARCH = `

LOCATION INTELLIGENCE:
Use location_search (not web_search) for:
- Drive time: location_search(query=..., fromLocation="<lat>,<lng>", toLocation=..., infoType="drive_time")
- Venue info: location_search(query=..., infoType="venue_info")
- Nearby: location_search(query=..., fromLocation="<lat>,<lng>", infoType="general")
CRITICAL: Always pass RAW GPS COORDINATES as fromLocation, never place names.
Save home/work addresses via update_profile.

WEB SEARCH: Use for restaurant details, venue info, business hours, recommendations. Don't use for standard calendar/task operations.`;

/**
 * MEMORY_MANAGEMENT section — When to save memories, triggers
 */
const MEMORY_MANAGEMENT = `

MEMORY TOOLS:
- search_memory_unified: Search memories/patterns (modes: personal, community, all)
- manage_patterns: Record behavioral patterns (frequency, confidence)
- update_memory_advanced: Save important insights (preferences, life changes, breakthroughs)
  - importance: "high" (core values), "medium" (useful patterns), "low" (minor observations)
  - triggerEarlyPersistence: true for critical insights
  - Don't use for routine operations or temporary info.`;

/**
 * PLANS_DETAIL section — Life plan tools
 */
const PLANS_DETAIL = `

LIFE PLAN:
- get_plan: Read current plan
- update_plan: Integrate new goals naturally (don't rewrite whole plan)
- Always update plan when creating goals.`;

/**
 * REMINDERS section
 */
const REMINDERS_SECTION = `

REMINDERS:
- create_reminder(message, triggerAt, aspectId) for one-time notifications
- Reminders are NOT calendar blocks — they're notification cards at the specified time.
- Use list_reminders, update_reminder, delete_reminder to manage.`;

// ============================================================
// SUMMARY CONTEXT BUILDER
// ============================================================

/**
 * Build a compact 1-2 line summary for simple queries (greetings, general chat).
 * Saves ~1,000-2,000 tokens vs full context listing.
 */
export function buildSummaryContext(
  events: any[],
  tasks: any[],
  goals: any[],
  timezone: string
): string {
  // date-fns-tz and date-fns imported at top of file

  // Today's events summary
  const now = new Date();
  const todayStr = formatInTimeZone(now, timezone, 'yyyy-MM-dd');

  const todayEvents = events.filter((e: any) => {
    const startStr = formatInTimeZone(toDate(e.start_time), timezone, 'yyyy-MM-dd');
    return startStr === todayStr;
  });

  const eventSummary = todayEvents.length > 0
    ? todayEvents.map((e: any) => {
        const time = formatInTimeZone(toDate(e.start_time), timezone, 'h:mma').toLowerCase();
        return `${time} ${e.title}`;
      }).join(', ')
    : 'no events';

  // Pending tasks count
  const pendingTasks = tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled');

  // Active goals count
  const activeGoals = goals.filter((g: any) => g.status === 'active' || !g.status);

  return `TODAY: ${todayEvents.length} events (${eventSummary}) | ${pendingTasks.length} tasks pending | ${activeGoals.length} goals active`;
}

// ============================================================
// SUMMARY PROMPT BUILDER
// ============================================================

/**
 * Build a minimal system prompt for summary/zero-tool mode.
 * Much shorter than buildCorePrompt — no tool usage guidance, no detailed context.
 */
function buildSummaryPrompt(context: PromptContext): string {
  const {
    timezone,
    todayFormatted,
    tomorrowDayName,
    userProfile,
    summaryContext,
    zepGraphContext,
    messageCount,
  } = context;

  const userName = userProfile?.preferred_name || userProfile?.display_name || '';
  const nameStr = userName ? ` The user's name is ${userName}.` : '';
  const msgCount = messageCount || 0;
  const stageGuidance = msgCount === 0
    ? ' New conversation — give a brief daily overview if the user greets.'
    : '';

  return `You are Glyde, a sharp and easygoing life assistant.${nameStr}${stageGuidance}

${summaryContext || ''}

TIME (${timezone}): Now: ${getCurrentTimeInTimezone(timezone)} | Today: ${todayFormatted} | Tomorrow: ${tomorrowDayName}
${zepGraphContext || ''}
COMMUNICATION: 1-3 sentences. Be concise and natural.`;
}

// ============================================================
// MAIN BUILDER
// ============================================================

/**
 * Builds the system prompt by assembling only the sections needed
 * based on the routing decision.
 */
export function buildSystemPrompt(context: PromptContext): SystemMessage {
  // Summary mode: use minimal prompt
  if (context.contextMode === 'summary') {
    return new SystemMessage(buildSummaryPrompt(context));
  }

  // Full mode: start with CORE
  let prompt = buildCorePrompt(context);

  const sections = context.promptSections || [
    // Default: include all sections (backward compatible)
    'core', 'calendar_detail', 'goal_creation', 'recurring_events',
    'friends_sharing', 'location_search', 'memory_management', 'plans_detail', 'reminders',
  ];

  // Conditionally append sections
  if (sections.includes('calendar_detail')) prompt += CALENDAR_DETAIL;
  if (sections.includes('goal_creation')) prompt += GOAL_CREATION;
  if (sections.includes('recurring_events')) prompt += RECURRING_EVENTS;
  if (sections.includes('friends_sharing')) prompt += FRIENDS_SHARING;
  if (sections.includes('location_search')) prompt += LOCATION_SEARCH;
  if (sections.includes('memory_management')) prompt += MEMORY_MANAGEMENT;
  if (sections.includes('plans_detail')) prompt += PLANS_DETAIL;
  if (sections.includes('reminders')) prompt += REMINDERS_SECTION;

  return new SystemMessage(prompt);
}
