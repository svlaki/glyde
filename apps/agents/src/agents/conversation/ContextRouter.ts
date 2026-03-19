import { ChatOpenAI } from "@langchain/openai";
import { env } from '../../utils/env.js';
import { ToolCategory, PromptSection, ContextMode, RoutingDecision } from '../../types/routing.js';

// Re-export types for convenience
export type { ToolCategory, PromptSection, ContextMode, RoutingDecision };

const ALWAYS_PROMPT_SECTIONS: PromptSection[] = ['core'];

const ROUTER_PROMPT = `You are a routing classifier. Given a user message, decide what the AI assistant needs.

Return JSON with these fields:
- needs_tools: boolean — does the user want to CREATE, UPDATE, DELETE, or SEARCH for something?
- tools: string[] — specific tool names needed (only when needs_tools=true)
- tool_categories: string[] — broad categories from [calendar_core, calendar_advanced, tasks, goals, aspects, reminders, friends, shared-events, memory, rules, search, profile, projects, plans]
- context_mode: "summary" or "full"
- context_sections: {events, tasks, goals, friends, rules, activity_logs, ratings, projects} — booleans
- prompt_sections: string[] from [core, calendar_detail, goal_creation, recurring_events, friends_sharing, location_search, memory_management, plans_detail, reminders]

Rules for needs_tools:
- false: ONLY pure greetings ("hey", "hi", "good morning", "how are you"), general advice/chat unrelated to calendar/tasks/goals
- true: ANY question about schedule/events/tasks/goals ("what's on my calendar", "what events", "how are my goals", "what tasks do I have", "what's on my schedule"), status checks, AND all action verbs: "create", "add", "schedule", "delete", "remove", "cancel", "update", "change", "remind me", "remember", "save", "search for [place]", "complete", "mark done", "find free time", "when am I free", "analyze my schedule", "clear my calendar", "tag", "share", "send friend request"
- true: ANY pasted text containing schedule information — syllabi, course pages, meeting agendas, event flyers, conference schedules, invitations, or any document with times/dates/recurring patterns (e.g. "TuTh 3:00-4:20PM", "MWF 10:00", "Lectures:", "Office Hours:", "every Monday", dates like "March 25"). These ALWAYS need calendar tools. Set tools=["create_recurring_event", "create_aspect", "create_event"] and tool_categories=["calendar_core", "calendar_advanced", "aspects"].
- IMPORTANT: If the message contains BOTH a greeting/question AND an action verb (e.g. "Good morning! Schedule...", "What's on my schedule? Also add a task..."), set needs_tools=true
- "schedule" as a VERB (e.g., "schedule a meeting") → true. "schedule" as a NOUN (e.g., "what's on my schedule") → true (needs tools to look up data).

Rules for tools (specific tool names, only when needs_tools=true):
- "create a meeting/event" → ["create_event"]
- "delete/cancel an event" → ["delete_event"]
- "update/move/reschedule event" → ["update_event"]
- "create a task/todo" → ["create_task"]
- "delete a task" → ["delete_task"]
- "complete/finish a task" → ["complete_task"]
- "update a task" → ["update_task"]
- "create a goal" → ["create_goal"]
- "delete a goal" → ["delete_goal"]
- "update a goal" → ["update_goal"]
- "remind me" → ["create_reminder"]
- "search for [place]" → ["location_search"]
- "search the web" → ["web_search"]
- "create an aspect" → ["create_aspect"]
- "create a rule" → ["create_rule"]
- "create a project" → ["create_project"]
- Multiple actions → include all needed tools
- Always include "create_aspect" alongside create tools if user might need a new aspect

Rules for context_mode:
- "summary": ONLY pure greetings ("hey", "hi", "good morning") with NO follow-up question or action request
- "full": ANY question about events/tasks/goals/schedule, status reviews, creating/modifying things, "what tasks", "what's on my schedule", "how are my goals"
- IMPORTANT: If needs_tools=true, context_mode MUST be "full". Never combine needs_tools=true with summary mode.

Rules for tool_categories:
- Add "tasks" if user mentions tasks, todos, action items
- Add "goals" if user mentions goals, milestones, progress
- Add "calendar_advanced" if user mentions recurring, bulk, reschedule, free time, analyze
- Add "reminders" if user mentions reminders, notifications, "remind me"
- Add "friends"/"shared-events" if user mentions friends, sharing, people
- Add "memory" if user shares preferences, insights, patterns
- Add "rules" if user mentions rules, "always", "never"
- Add "search" if user mentions places, restaurants, directions, "where", "nearby"
- Add "profile" if user mentions their settings, preferences
- Add "projects" if user mentions projects
- Add "plans" if user mentions life plan
- Questions about events/schedule → tool_categories: ["calendar_core"]
- Questions about tasks → tool_categories: ["tasks"]
- Questions about goals → tool_categories: ["goals"]
- For greetings/general chat with needs_tools=false: tool_categories=[], context_sections all false except events+tasks+goals

Rules for context_sections:
- events, tasks, goals: true when context_mode="full", true when needs_tools=true for related categories
- For summary mode: events=true, tasks=true, goals=true (minimal data sent), rest false
- friends: true only when friends/shared-events mentioned
- rules: true only when rules mentioned
- activity_logs, ratings: true only when specifically relevant
- projects: true only when projects mentioned

Return ONLY valid JSON, no explanation.`;

/**
 * ContextRouter: A cheap pre-classifier that determines what tools, context,
 * and prompt sections the main model needs for a given message.
 *
 * Uses GPT-4o-mini (~$0.0001/call) to save ~$0.05/call on the main model
 * by reducing tool definitions, context, and prompt sections.
 */
export class ContextRouter {
  private routerModel: ChatOpenAI;

  constructor() {
    this.routerModel = new ChatOpenAI({
      modelName: 'gpt-4.1-nano',
      temperature: 0,
      apiKey: env.OPENAI_API_KEY,
      maxTokens: 500,
      timeout: 5000,
    });
  }

  /**
   * Route a user message to determine what the main model needs.
   * @param userMessage The current user message
   * @param recentMessages Last 2 messages for context (optional)
   * @returns RoutingDecision with tool categories, context sections, and prompt sections
   */
  /**
   * Deterministic check for pasted schedule/document content.
   * The nano router can't reliably detect these — it sees a wall of text
   * and classifies as needs_tools=false. This catches it before the LLM.
   */
  private detectScheduleContent(message: string): boolean {
    const lower = message.toLowerCase();
    const len = message.length;

    // Short messages are never pasted documents
    if (len < 150) return false;

    // Schedule time patterns: "TuTh 3:00-4:20PM", "MWF 10:00-11:00AM", "Monday 2:00 PM"
    const timePatterns = [
      /\b(?:MWF|MW|TuTh|TTh|MoWeFr|TuTh?)\s+\d{1,2}[:.]\d{2}/i,
      /\blectures?[:\s]+(?:mon|tue|wed|thu|fri|sat|sun|MWF|MW|TuTh|TTh)/i,
      /\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?s?\s+(?:and\s+)?(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?s?\s+\d{1,2}[:.]\d{2}/i,
    ];

    // Document structure keywords (multiple must match to avoid false positives)
    const docKeywords = [
      'instructor', 'teaching assistant', 'office hours', 'syllabus',
      'grading', 'problem sets', 'examinations', 'prerequisites',
      'textbook', 'lectures', 'midterm', 'final exam', 'course',
      'collaboration policy', 'attendance', 'schedule', 'recitation',
      'lab section', 'section', 'quarter', 'semester',
    ];

    const hasTimePattern = timePatterns.some(p => p.test(message));
    const matchingKeywords = docKeywords.filter(k => lower.includes(k));
    const hasDocStructure = matchingKeywords.length >= 3;

    return hasTimePattern || (hasDocStructure && len > 300);
  }

  async route(userMessage: string, recentMessages?: string[]): Promise<RoutingDecision> {
    try {
      // Force needs_tools=true — the nano router is unreliable at detecting
      // implicit tool needs (pasted schedules, documents with dates, etc.)
      // The main model can decide not to call tools if none are needed.
      const forceTools = true;

      // Deterministic pre-check: pasted schedule/document content
      const isScheduleContent = this.detectScheduleContent(userMessage);
      if (isScheduleContent) {
        console.log('[CONTEXT ROUTER] Detected pasted schedule content — forcing calendar tools');
        return this.normalizeDecision({
          needs_tools: true,
          tools: ['create_recurring_event', 'create_aspect', 'create_event'],
          tool_categories: ['calendar_core', 'calendar_advanced', 'aspects'],
          context_mode: 'full',
          context_sections: { events: true, tasks: true, goals: true, friends: false, rules: false, activity_logs: false, ratings: false, projects: false },
          prompt_sections: ['core', 'calendar_detail', 'recurring_events'],
        });
      }

      const contextStr = recentMessages?.length
        ? `\nRecent context:\n${recentMessages.map((m, i) => {
            const truncated = m.length > 200 ? m.slice(0, 200) + '...' : m;
            return `${i + 1}. ${truncated}`;
          }).join('\n')}`
        : '';

      const response = await this.routerModel.invoke([
        { role: 'system', content: ROUTER_PROMPT },
        { role: 'user', content: `User message: "${userMessage}"${contextStr}` },
      ]);

      const content = typeof response.content === 'string' ? response.content : '';
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[CONTEXT ROUTER] No JSON found in response, using defaults');
        return this.getDefaultDecision();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      // Force tools always available — main model decides whether to call them
      if (forceTools) {
        parsed.needs_tools = true;
        parsed.context_mode = 'full';
      }
      return this.normalizeDecision(parsed);
    } catch (error) {
      console.error('[CONTEXT ROUTER] Error routing message, using defaults:', error);
      return this.getDefaultDecision();
    }
  }

  /**
   * Ensure the routing decision always includes required fields
   * and validates the structure.
   */
  private normalizeDecision(raw: any): RoutingDecision {
    // Determine needs_tools
    const needsTools = raw.needs_tools === true;

    // Parse specific tool names — validate against known tool names
    const tools: string[] = [];
    if (needsTools && Array.isArray(raw.tools)) {
      for (const t of raw.tools) {
        if (typeof t === 'string' && t.length > 0) {
          if (ContextRouter.TOOL_TO_CATEGORY[t]) {
            tools.push(t);
          } else {
            console.warn(`[CONTEXT ROUTER] Unknown tool name from router: "${t}"`);
          }
        }
      }
    }

    // Parse tool categories
    const toolCategories = new Set<ToolCategory>();
    if (Array.isArray(raw.tool_categories)) {
      for (const cat of raw.tool_categories) {
        if (this.isValidToolCategory(cat)) {
          toolCategories.add(cat);
        }
      }
    }

    // If needs_tools but no categories were specified, infer from tool names
    if (needsTools && toolCategories.size === 0 && tools.length > 0) {
      for (const t of tools) {
        const cat = this.inferCategoryFromTool(t);
        if (cat) toolCategories.add(cat);
      }
    }

    // If needs_tools, always include aspects (needed for create operations)
    if (needsTools) {
      toolCategories.add('aspects');
    }

    // Auto-include dependent categories
    if (toolCategories.has('goals')) {
      toolCategories.add('plans'); // goal creation flow uses get_plan/update_plan
    }

    // Determine context mode — force "full" when tools are needed
    const contextMode: ContextMode = (needsTools || raw.context_mode !== 'summary') ? 'full' : 'summary';

    // Filter context sections
    const validContextKeys = ['events', 'tasks', 'goals', 'friends', 'rules', 'activity_logs', 'ratings', 'projects'] as const;
    const rawSections = raw.context_sections || {};
    const contextSections = {
      events: true,
      tasks: true,
      goals: true,
      friends: false,
      rules: false,
      activity_logs: false,
      ratings: false,
      projects: false,
    };
    for (const key of validContextKeys) {
      if (key in rawSections && typeof rawSections[key] === 'boolean') {
        (contextSections as any)[key] = rawSections[key];
      }
    }

    // Parse prompt sections
    const promptSections = new Set<PromptSection>(ALWAYS_PROMPT_SECTIONS);
    if (Array.isArray(raw.prompt_sections)) {
      for (const sec of raw.prompt_sections) {
        if (this.isValidPromptSection(sec)) {
          promptSections.add(sec);
        }
      }
    }

    // Auto-include prompt sections based on tool categories
    // (router may include category but forget the matching prompt section)
    if (toolCategories.has('goals')) promptSections.add('goal_creation');
    if (toolCategories.has('calendar_advanced')) {
      promptSections.add('recurring_events');
      promptSections.add('calendar_detail');
    }
    if (toolCategories.has('calendar_core')) promptSections.add('calendar_detail');
    if (toolCategories.has('reminders')) promptSections.add('reminders');
    if (toolCategories.has('friends') || toolCategories.has('shared-events')) promptSections.add('friends_sharing');
    if (toolCategories.has('search')) promptSections.add('location_search');
    if (toolCategories.has('memory')) promptSections.add('memory_management');
    if (toolCategories.has('plans')) promptSections.add('plans_detail');

    const decision: RoutingDecision = {
      needs_tools: needsTools,
      tools: needsTools ? (tools.length > 0 ? tools : undefined) : undefined,
      tool_categories: Array.from(toolCategories),
      context_mode: contextMode,
      context_sections: contextSections,
      prompt_sections: Array.from(promptSections),
    };

    console.log(`[CONTEXT ROUTER] Decision: needs_tools=${decision.needs_tools} tools=[${decision.tools?.join(',') || 'none'}] categories=[${decision.tool_categories.join(',')}] mode=${decision.context_mode} context=[${Object.entries(decision.context_sections).filter(([,v]) => v).map(([k]) => k).join(',')}] prompts=[${decision.prompt_sections.join(',')}]`);

    return decision;
  }

  /**
   * Deterministic tool-name → category lookup.
   * Using an explicit map avoids ordering bugs from includes() checks.
   */
  private static readonly TOOL_TO_CATEGORY: Record<string, ToolCategory> = {
    // calendar_core
    create_event: 'calendar_core',
    update_event: 'calendar_core',
    delete_event: 'calendar_core',
    search_events: 'calendar_core',
    list_events: 'calendar_core',
    // calendar_advanced
    delete_multiple_events: 'calendar_advanced',
    bulk_update_events: 'calendar_advanced',
    analyze_schedule: 'calendar_advanced',
    create_recurring_event: 'calendar_advanced',
    update_recurring_event: 'calendar_advanced',
    delete_recurring_event: 'calendar_advanced',
    find_free_time: 'calendar_advanced',
    // tasks
    create_task: 'tasks',
    update_task: 'tasks',
    delete_task: 'tasks',
    list_tasks: 'tasks',
    complete_task: 'tasks',
    search_tasks: 'tasks',
    // goals
    create_goal: 'goals',
    update_goal: 'goals',
    list_goals: 'goals',
    check_in_goal: 'goals',
    delete_goal: 'goals',
    // aspects
    create_aspect: 'aspects',
    list_aspects: 'aspects',
    update_aspect: 'aspects',
    delete_aspect: 'aspects',
    archive_aspect: 'aspects',
    // reminders
    create_reminder: 'reminders',
    update_reminder: 'reminders',
    delete_reminder: 'reminders',
    list_reminders: 'reminders',
    // friends
    list_friends: 'friends',
    get_pending_friend_requests: 'friends',
    send_friend_request: 'friends',
    accept_friend_request: 'friends',
    decline_friend_request: 'friends',
    remove_friend: 'friends',
    update_friend_notes: 'friends',
    add_friend_aspect: 'friends',
    remove_friend_aspect: 'friends',
    // shared-events
    add_event_member: 'shared-events',
    remove_event_member: 'shared-events',
    get_event_members: 'shared-events',
    update_member_role: 'shared-events',
    // memory
    search_memory_unified: 'memory',
    manage_patterns: 'memory',
    update_memory_advanced: 'memory',
    // rules
    create_rule: 'rules',
    list_rules: 'rules',
    delete_rule: 'rules',
    toggle_rule: 'rules',
    // search
    web_search: 'search',
    location_search: 'search',
    // profile
    get_profile: 'profile',
    update_profile: 'profile',
    // projects
    create_project: 'projects',
    list_projects: 'projects',
    update_project: 'projects',
    archive_project: 'projects',
    unarchive_project: 'projects',
    delete_project: 'projects',
    tag_to_project: 'projects',
    // plans
    get_plan: 'plans',
    update_plan: 'plans',
  };

  private inferCategoryFromTool(toolName: string): ToolCategory | null {
    return ContextRouter.TOOL_TO_CATEGORY[toolName] ?? null;
  }

  /**
   * Default decision when routing fails — includes everything essential.
   * More generous than a typical route to avoid missing needed context.
   */
  private getDefaultDecision(): RoutingDecision {
    // When routing fails, be maximally generous — cost savings are already lost
    return {
      needs_tools: true,
      tool_categories: [
        'calendar_core', 'calendar_advanced', 'tasks', 'goals', 'aspects',
        'reminders', 'memory', 'plans', 'friends', 'shared-events',
        'search', 'profile', 'projects', 'rules',
      ],
      context_mode: 'full',
      context_sections: {
        events: true,
        tasks: true,
        goals: true,
        friends: true,
        rules: true,
        activity_logs: false,
        ratings: false,
        projects: true,
      },
      prompt_sections: [
        'core', 'calendar_detail', 'goal_creation', 'recurring_events',
        'reminders', 'plans_detail', 'memory_management', 'friends_sharing',
        'location_search',
      ],
    };
  }

  private isValidToolCategory(cat: string): cat is ToolCategory {
    return ['calendar_core', 'calendar_advanced', 'tasks', 'goals', 'aspects', 'reminders', 'friends',
      'shared-events', 'memory', 'rules', 'search', 'profile', 'projects', 'plans'].includes(cat);
  }

  private isValidPromptSection(sec: string): sec is PromptSection {
    return ['core', 'calendar_detail', 'goal_creation', 'recurring_events',
      'friends_sharing', 'location_search', 'memory_management', 'plans_detail', 'reminders'].includes(sec);
  }
}
