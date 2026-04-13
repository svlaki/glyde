/**
 * ConversationAgent Feedback Loop
 *
 * Interactive test harness for rapid iteration on prompt/logic changes.
 * Runs prompts through the agent with full mocks, prints tool calls + response.
 * Always passes — never fails CI.
 *
 * Usage:
 *   PROMPT="schedule dentist tomorrow at 2pm" npm run feedback
 *   npm run feedback          (uses feedback-prompts.txt alongside this file)
 *   npm run feedback:watch    (auto-reruns on file changes)
 *
 * NOTE: Tool call ordering is approximate. extractToolCallsFromMocks() iterates
 * service method arrays in a fixed sequence, so cross-service ordering (e.g.
 * create_aspect vs create_event in the same turn) may not reflect exact LLM
 * execution order. Within-service ordering is correct.
 */

// ============================================================
// ZONE A — HOISTED MOCK STATE + FACTORIES
// Must appear before all imports.
// ============================================================

const mockState = {
  events: [] as any[],
  tasks: [] as any[],
  goals: [] as any[],
  categories: [
    { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
    { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
  ] as any[],
  rules: [] as any[],
  reminders: [] as any[],
};

const {
  mockSupabaseService,
  mockRuleService,
  mockMemoryService,
  mockAspectService,
} = vi.hoisted(() => {
  const mockSupabaseService = {
    // Profile
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      timezone: 'America/New_York',
      email: 'test@example.com',
      name: 'Test User',
    }),
    updateProfile: vi.fn().mockResolvedValue({}),

    // Events
    getEvents: vi.fn().mockImplementation(async () => mockState.events),
    getEventsForAgent: vi.fn().mockImplementation(async () => mockState.events),
    getExpandedEvents: vi.fn().mockImplementation(async () => mockState.events),
    createEvent: vi.fn().mockImplementation(async (userId: string, event: any) => {
      const newEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: userId,
        ...event,
        created_at: new Date().toISOString(),
      };
      mockState.events.push(newEvent);
      return newEvent;
    }),
    updateEvent: vi.fn().mockImplementation(async (userId: string, eventId: string, updates: any) => {
      const index = mockState.events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        mockState.events[index] = { ...mockState.events[index], ...updates, updated_at: new Date().toISOString() };
        return mockState.events[index];
      }
      return { id: eventId, user_id: userId, ...updates, updated_at: new Date().toISOString() };
    }),
    deleteEvent: vi.fn().mockImplementation(async (_userId: string, eventId: string) => {
      const index = mockState.events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) mockState.events.splice(index, 1);
      return { success: true };
    }),
    deleteMultipleEvents: vi.fn().mockImplementation(async (_userId: string, eventIds: string[]) => {
      for (const id of eventIds) {
        const index = mockState.events.findIndex((e: any) => e.id === id);
        if (index !== -1) mockState.events.splice(index, 1);
      }
      return { success: true, deletedCount: eventIds.length };
    }),
    createRecurringEvent: vi.fn().mockImplementation(async (userId: string, event: any) => {
      const newEvent = {
        id: `recurring-evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: userId,
        ...event,
        is_recurring: true,
        created_at: new Date().toISOString(),
      };
      mockState.events.push(newEvent);
      return newEvent;
    }),
    updateRecurringEvent: vi.fn().mockImplementation(async (userId: string, eventId: string, updates: any) => ({
      id: eventId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteRecurringEvent: vi.fn().mockImplementation(async (_userId: string, eventId: string) => {
      const index = mockState.events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) mockState.events.splice(index, 1);
      return { success: true };
    }),
    bulkUpdateEvents: vi.fn().mockResolvedValue({ success: true }),
    searchEvents: vi.fn().mockImplementation(async () => mockState.events),

    // Tasks
    getTasks: vi.fn().mockImplementation(async () => mockState.tasks),
    createTask: vi.fn().mockImplementation(async (userId: string, task: any) => {
      const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: userId,
        ...task,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      mockState.tasks.push(newTask);
      return newTask;
    }),
    updateTask: vi.fn().mockImplementation(async (userId: string, taskId: string, updates: any) => ({
      id: taskId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteTask: vi.fn().mockImplementation(async (_userId: string, taskId: string) => {
      const index = mockState.tasks.findIndex((t: any) => t.id === taskId);
      if (index !== -1) mockState.tasks.splice(index, 1);
      return { success: true };
    }),
    completeTask: vi.fn().mockImplementation(async (userId: string, taskId: string) => ({
      id: taskId,
      user_id: userId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })),
    searchTasks: vi.fn().mockImplementation(async () => mockState.tasks),

    // Goals
    getGoals: vi.fn().mockImplementation(async () => mockState.goals),
    createGoal: vi.fn().mockImplementation(async (userId: string, goal: any) => {
      const newGoal = {
        id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: userId,
        ...goal,
        status: 'in_progress',
        created_at: new Date().toISOString(),
      };
      mockState.goals.push(newGoal);
      return newGoal;
    }),
    updateGoal: vi.fn().mockImplementation(async (userId: string, goalId: string, updates: any) => ({
      id: goalId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteGoal: vi.fn().mockImplementation(async (_userId: string, goalId: string) => {
      const index = mockState.goals.findIndex((g: any) => g.id === goalId);
      if (index !== -1) mockState.goals.splice(index, 1);
      return { success: true };
    }),
    addGoalCheckIn: vi.fn().mockImplementation(async (_userId: string, goalId: string, checkIn: any) => ({
      id: `checkin-${Date.now()}`,
      goal_id: goalId,
      ...checkIn,
      created_at: new Date().toISOString(),
    })),
    getGoalCheckIns: vi.fn().mockResolvedValue([]),

    // Aspects
    getAspects: vi.fn().mockImplementation(async () => mockState.categories),

    // Reminders
    createReminder: vi.fn().mockImplementation(async (userId: string, reminder: any) => ({
      id: `reminder-${Date.now()}`,
      user_id: userId,
      ...reminder,
      created_at: new Date().toISOString(),
    })),
    updateReminder: vi.fn().mockResolvedValue({}),
    deleteReminder: vi.fn().mockResolvedValue({ success: true }),
    getReminders: vi.fn().mockResolvedValue([]),

    // Notes
    createNotes: vi.fn().mockImplementation(async (userId: string, note: any) => ({
      id: `note-${Date.now()}`,
      user_id: userId,
      ...note,
      created_at: new Date().toISOString(),
    })),
    updateNotes: vi.fn().mockResolvedValue({}),
    getNotes: vi.fn().mockResolvedValue(null),

    // Activity (conditionally loaded by agent for context)
    getRecentActivity: vi.fn().mockResolvedValue([]),

    // Client stub — needs .from() for ReminderService and other direct Supabase callers
    getClient: vi.fn().mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: null, error: null }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),

    // Settings
    getUserSettings: vi.fn().mockResolvedValue({}),
    updateUserSetting: vi.fn().mockResolvedValue(true),
  };

  const mockRuleService = {
    getRules: vi.fn().mockImplementation(async () => mockState.rules),
    getEnabledRules: vi.fn().mockImplementation(async () =>
      mockState.rules.filter((r: any) => r.enabled)
    ),
    getRule: vi.fn().mockImplementation(async (_userId: string, ruleId: string) =>
      mockState.rules.find((r: any) => r.id === ruleId) || null
    ),
    createRule: vi.fn().mockImplementation(async (userId: string, input: any) => {
      const rule = {
        id: `rule-${Date.now()}`,
        user_id: userId,
        rule_text: input.rule_text,
        description: input.description || null,
        enabled: true,
        priority: input.priority || 5,
        source: input.source || 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockState.rules.push(rule);
      return rule;
    }),
    updateRule: vi.fn().mockResolvedValue({}),
    deleteRule: vi.fn().mockImplementation(async (_userId: string, ruleId: string) => {
      const index = mockState.rules.findIndex((r: any) => r.id === ruleId);
      if (index !== -1) mockState.rules.splice(index, 1);
      return { success: true };
    }),
    toggleRule: vi.fn().mockImplementation(async (_userId: string, ruleId: string, enabled: boolean) => {
      const index = mockState.rules.findIndex((r: any) => r.id === ruleId);
      if (index !== -1) {
        mockState.rules[index] = { ...mockState.rules[index], enabled, updated_at: new Date().toISOString() };
        return mockState.rules[index];
      }
      return { id: ruleId, enabled, updated_at: new Date().toISOString() };
    }),
    searchRules: vi.fn().mockImplementation(async (_userId: string, query: string) => {
      const q = query.toLowerCase();
      return mockState.rules.filter((r: any) =>
        r.rule_text.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    }),
    formatRulesForPrompt: vi.fn().mockImplementation(() =>
      mockState.rules.length > 0
        ? mockState.rules
            .map((r: any) => `- [${r.enabled ? 'ENABLED' : 'DISABLED'}] ${r.rule_text} (ID: ${r.id})`)
            .join('\n')
        : ''
    ),
  };

  const mockMemoryService = {
    getUserContext: vi.fn().mockResolvedValue(''),
    persistConversation: vi.fn().mockResolvedValue(undefined),
    searchFacts: vi.fn().mockResolvedValue([]),
    addFact: vi.fn().mockResolvedValue(undefined),
    addFacts: vi.fn().mockResolvedValue(undefined),
    invalidateFacts: vi.fn().mockResolvedValue(undefined),
    seedOnboardingData: vi.fn().mockResolvedValue(undefined),
    rebuildUserContext: vi.fn().mockResolvedValue(''),
  };

  const mockAspectService = {
    getAspects: vi.fn().mockImplementation(async () => mockState.categories),
    getAspectByName: vi.fn().mockImplementation(async (_userId: string, name: string) => {
      const normalized = name.toLowerCase().trim();
      return mockState.categories.find(
        (c: any) => c.name.toLowerCase().trim() === normalized
      ) || null;
    }),
    createAspect: vi.fn().mockImplementation(async (userId: string, input: any) => {
      const aspectName = typeof input === 'object' ? input.name : input;
      const aspectColor = typeof input === 'object' ? input.color : '#808080';
      const newAspect = {
        id: `asp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: userId,
        name: aspectName,
        color: aspectColor || '#808080',
        created_at: new Date().toISOString(),
      };
      mockState.categories.push(newAspect);
      return newAspect;
    }),
    updateAspect: vi.fn().mockResolvedValue({}),
    deleteAspect: vi.fn().mockImplementation(async (_userId: string, aspectId: string) => {
      const index = mockState.categories.findIndex((c: any) => c.id === aspectId);
      if (index !== -1) mockState.categories.splice(index, 1);
      return { success: true };
    }),
  };

  return {
    mockSupabaseService,
    mockRuleService,
    mockMemoryService,
    mockAspectService,
  };
});

// ============================================================
// ZONE B — MODULE MOCKS (must be top-level, before imports)
// ============================================================

vi.mock('../../../../services/SupabaseService.js', () => {
  // Inline stub — cannot reference module-scope vars here since vi.mock is hoisted
  const makeChain = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  const clientStub = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: null, error: null }) },
    from: vi.fn().mockReturnValue(makeChain()),
  };
  return {
    initializeSupabase: vi.fn(),
    SupabaseService: vi.fn(() => mockSupabaseService),
    getSupabaseService: () => mockSupabaseService,
    getSupabaseClient: () => clientStub,
    supabase: clientStub,
  };
});

vi.mock('../../../../services/RuleService.js', () => ({
  default: mockRuleService,
  RuleService: vi.fn(() => mockRuleService),
}));

vi.mock('../../../../services/MemoryService.js', () => ({
  MemoryService: {
    getInstance: () => mockMemoryService,
  },
}));

vi.mock('../../../../services/AspectService.js', () => ({
  default: mockAspectService,
  AspectService: vi.fn(() => mockAspectService),
}));

vi.mock('../../../../utils/env.js', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    PORT: 8000,
    NODE_ENV: 'test',
  },
  isDevelopment: false,
  ENV_PATH: '/test/.env',
}));

vi.mock('../../../../services/FriendshipService.js', () => ({
  FriendshipService: vi.fn().mockImplementation(() => ({
    getFriends: vi.fn().mockResolvedValue({ success: true, data: [] }),
    sendFriendRequest: vi.fn().mockResolvedValue({ success: true }),
    acceptFriendRequest: vi.fn().mockResolvedValue({ success: true }),
    declineFriendRequest: vi.fn().mockResolvedValue({ success: true }),
    removeFriend: vi.fn().mockResolvedValue({ success: true }),
    updateFriendNotes: vi.fn().mockResolvedValue({ success: true }),
    getFriendRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  })),
}));

vi.mock('../../../../services/ProjectService.js', () => ({
  default: {
    getProjects: vi.fn().mockResolvedValue([]),
    createProject: vi.fn().mockImplementation(async (userId: string, data: any) => ({
      id: `proj-${Date.now()}`,
      user_id: userId,
      ...data,
      created_at: new Date().toISOString(),
    })),
    updateProject: vi.fn().mockResolvedValue({}),
    deleteProject: vi.fn().mockResolvedValue({ success: true }),
    archiveProject: vi.fn().mockResolvedValue({}),
    unarchiveProject: vi.fn().mockResolvedValue({}),
    tagToProject: vi.fn().mockResolvedValue({}),
    listProjects: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../../../services/ReminderService.js', () => ({
  ReminderService: vi.fn().mockImplementation(() => ({
    syncEventReminder: vi.fn().mockResolvedValue(undefined),
    createReminder: vi.fn().mockResolvedValue({ id: `reminder-stub`, success: true }),
    updateReminder: vi.fn().mockResolvedValue({ success: true }),
    deleteReminder: vi.fn().mockResolvedValue({ success: true }),
    getRemindersByEvent: vi.fn().mockResolvedValue([]),
    deleteByEventId: vi.fn().mockResolvedValue({ success: true }),
  })),
  default: {
    syncEventReminder: vi.fn().mockResolvedValue(undefined),
    createReminder: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// ============================================================
// ZONE C — IMPORTS (after all mocks)
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, beforeAll, vi } from 'vitest';
import { ConversationAgent } from '../../ConversationAgent.js';
import type { CapturedToolCall } from './behavior-test-utils.js';

// ============================================================
// ZONE D — HELPERS + TEST BODY
// ============================================================

// Get directory of THIS file so we can find feedback-prompts.txt next to it
const __dir = dirname(fileURLToPath(import.meta.url));

// -------------------------------------------------------------------
// resetMockState — reset in-memory data between sessions (not turns)
// -------------------------------------------------------------------
function resetMockState() {
  mockState.events = [];
  mockState.tasks = [];
  mockState.goals = [];
  mockState.categories = [
    { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
    { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
  ];
  mockState.rules = [];
  mockState.reminders = [];
}

// -------------------------------------------------------------------
// Map service method names → logical tool names for display
// -------------------------------------------------------------------
const serviceMethodToToolName: Record<string, string> = {
  // Calendar
  createEvent: 'create_event',
  updateEvent: 'update_event',
  deleteEvent: 'delete_event',
  deleteMultipleEvents: 'delete_multiple_events',
  createRecurringEvent: 'create_recurring_event',
  updateRecurringEvent: 'update_recurring_event',
  deleteRecurringEvent: 'delete_recurring_event',
  bulkUpdateEvents: 'bulk_update_events',
  searchEvents: 'search_events',
  // Tasks
  createTask: 'create_task',
  updateTask: 'update_task',
  deleteTask: 'delete_task',
  completeTask: 'complete_task',
  searchTasks: 'search_tasks',
  // Goals
  createGoal: 'create_goal',
  updateGoal: 'update_goal',
  deleteGoal: 'delete_goal',
  addGoalCheckIn: 'check_in_goal',
  // Aspects
  createAspect: 'create_aspect',
  updateAspect: 'update_aspect',
  deleteAspect: 'delete_aspect',
  // Reminders
  createReminder: 'create_reminder',
  updateReminder: 'update_reminder',
  deleteReminder: 'delete_reminder',
  // Rules
  createRule: 'create_rule',
  deleteRule: 'delete_rule',
  toggleRule: 'toggle_rule',
  // Profile
  updateProfile: 'update_profile',
  // Notes
  createNotes: 'create_notes',
  updateNotes: 'update_notes',
};

// -------------------------------------------------------------------
// extractToolCallsFromMocks — infer what tools fired from mock calls
// -------------------------------------------------------------------
function extractToolCallsFromMocks(): CapturedToolCall[] {
  const calls: CapturedToolCall[] = [];
  let order = 0;

  const supabaseMutations = [
    'createEvent', 'updateEvent', 'deleteEvent', 'deleteMultipleEvents',
    'createRecurringEvent', 'updateRecurringEvent', 'deleteRecurringEvent',
    'bulkUpdateEvents',
    'createTask', 'updateTask', 'deleteTask', 'completeTask',
    'createGoal', 'updateGoal', 'deleteGoal', 'addGoalCheckIn',
    'createReminder', 'updateReminder', 'deleteReminder',
    'createNotes', 'updateNotes',
    'updateProfile',
  ];

  for (const method of supabaseMutations) {
    const mock = (mockSupabaseService as any)[method];
    if (mock?.mock?.calls?.length > 0) {
      for (const callArgs of mock.mock.calls) {
        const toolName = serviceMethodToToolName[method] || method;
        calls.push({
          name: toolName,
          // First arg is always userId — strip it, second arg is the payload
          args: callArgs.length > 1 ? callArgs[1] : callArgs[0] ?? {},
          timestamp: Date.now(),
          order: order++,
        });
      }
    }
  }

  // Aspect mutations (AspectService)
  const aspectMutations = ['createAspect', 'updateAspect', 'deleteAspect'];
  for (const method of aspectMutations) {
    const mock = (mockAspectService as any)[method];
    if (mock?.mock?.calls?.length > 0) {
      for (const callArgs of mock.mock.calls) {
        const toolName = serviceMethodToToolName[method] || method;
        let args: any;
        if (callArgs.length > 1) {
          args = typeof callArgs[1] === 'object' && callArgs[1] !== null && 'name' in callArgs[1]
            ? callArgs[1]
            : { name: callArgs[1], color: callArgs[2] };
        } else {
          args = callArgs[0] ?? {};
        }
        calls.push({ name: toolName, args, timestamp: Date.now(), order: order++ });
      }
    }
  }

  // Rule mutations (RuleService)
  const ruleMutations = ['createRule', 'toggleRule', 'deleteRule'];
  for (const method of ruleMutations) {
    const mock = (mockRuleService as any)[method];
    if (mock?.mock?.calls?.length > 0) {
      for (const callArgs of mock.mock.calls) {
        const toolName = serviceMethodToToolName[method] || method;
        let args: any;
        if (method === 'toggleRule') {
          args = { rule_id: callArgs[1], enabled: callArgs[2] };
        } else if (method === 'createRule') {
          args = callArgs[1] ?? {};
        } else {
          args = callArgs.length > 1 ? { rule_id: callArgs[1] } : {};
        }
        calls.push({ name: toolName, args, timestamp: Date.now(), order: order++ });
      }
    }
  }

  return calls;
}

// -------------------------------------------------------------------
// executePrompt — run one message through the agent
// conversationHistory persists across turns for multi-turn sessions
// -------------------------------------------------------------------
async function executePrompt(
  agent: ConversationAgent,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<{ response: string; calls: CapturedToolCall[] }> {
  // Clear call tracking only — does NOT clear mock implementations or mockState
  vi.clearAllMocks();

  const context = {
    userId: 'test-user-id',
    sessionId: 'feedback-session-id',
    timezone: 'America/New_York',
    conversationHistory,
  };

  try {
    const result = await agent.processMessage(context, message);
    const calls = extractToolCallsFromMocks();
    return { response: result.content, calls };
  } catch (error) {
    const calls = extractToolCallsFromMocks();
    return {
      response: `[ERROR] ${error instanceof Error ? error.message : String(error)}`,
      calls,
    };
  }
}

// -------------------------------------------------------------------
// loadPrompts — read from env var, file, or fallback
// -------------------------------------------------------------------
function loadPrompts(): string[] {
  if (process.env.PROMPT) {
    return [process.env.PROMPT];
  }

  const filePath = resolve(__dir, 'feedback-prompts.txt');
  if (existsSync(filePath)) {
    const lines = readFileSync(filePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    if (lines.length > 0) return lines;
  }

  return ['What events do I have this week?'];
}

// -------------------------------------------------------------------
// formatOutput — rich display written to stderr (always visible)
// -------------------------------------------------------------------
const LINE = '\u2501'.repeat(68);

function formatOutput(
  index: number,
  message: string,
  calls: CapturedToolCall[],
  response: string,
  durationMs: number
): string {
  const header = `\u2501\u2501\u2501 Message ${index}: "${message.length > 55 ? message.slice(0, 52) + '...' : message}" `;
  const headerLine = header + '\u2501'.repeat(Math.max(0, 68 - header.length));

  const lines: string[] = ['', headerLine, ''];

  // Tool calls
  if (calls.length === 0) {
    lines.push('  TOOL CALLS: none');
  } else {
    lines.push(`  TOOL CALLS (${calls.length}, ${(durationMs / 1000).toFixed(1)}s total)`);
    for (const call of calls) {
      const argsJson = JSON.stringify(call.args, null, 2);
      const argsIndented = argsJson
        .split('\n')
        .map((l, i) => (i === 0 ? l : '         ' + l))
        .join('\n');
      lines.push(`    ${call.order + 1}. ${call.name}(${argsIndented})`);
    }
  }

  lines.push('');

  // Response
  lines.push('  RESPONSE');
  const wrapped = response
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n');
  lines.push(wrapped);
  lines.push('');
  lines.push(LINE);
  lines.push('');

  return lines.join('\n');
}

// -------------------------------------------------------------------
// State snapshot helper — shows what's in mockState after each turn
// -------------------------------------------------------------------
function formatStateSnapshot(): string {
  const parts: string[] = [];
  if (mockState.events.length > 0) {
    parts.push(`  events(${mockState.events.length}): ${mockState.events.map((e: any) => e.title || e.id).join(', ')}`);
  }
  if (mockState.tasks.length > 0) {
    parts.push(`  tasks(${mockState.tasks.length}): ${mockState.tasks.map((t: any) => t.title || t.id).join(', ')}`);
  }
  if (mockState.goals.length > 0) {
    parts.push(`  goals(${mockState.goals.length}): ${mockState.goals.map((g: any) => g.title || g.id).join(', ')}`);
  }
  if (mockState.rules.length > 0) {
    parts.push(`  rules(${mockState.rules.length}): ${mockState.rules.map((r: any) => r.rule_text?.slice(0, 40) || r.id).join(', ')}`);
  }
  if (mockState.categories.length > 2) {
    const custom = mockState.categories.slice(2);
    parts.push(`  aspects(+${custom.length} new): ${custom.map((c: any) => c.name).join(', ')}`);
  }
  return parts.length > 0 ? '\n  IN-MEMORY STATE:\n' + parts.join('\n') + '\n' : '';
}

// ============================================================
// TEST SUITE
// ============================================================

describe('ConversationAgent Feedback Loop', () => {
  let agent: ConversationAgent;

  beforeAll(async () => {
    agent = new ConversationAgent();
    await agent.initialize();
    resetMockState(); // reset once at session start; state persists across turns
  });

  it(
    'runs feedback prompts',
    async () => {
      const prompts = loadPrompts();
      const conversationHistory: Array<{ role: string; content: string }> = [];

      process.stderr.write(`\n${'='.repeat(68)}\n`);
      process.stderr.write(`GLYDE FEEDBACK LOOP — ${prompts.length} prompt(s)\n`);
      process.stderr.write(`${'='.repeat(68)}\n`);

      for (const [i, prompt] of prompts.entries()) {
        const start = Date.now();
        const { response, calls } = await executePrompt(agent, prompt, conversationHistory);
        const duration = Date.now() - start;

        process.stderr.write(formatOutput(i + 1, prompt, calls, response, duration));

        const snapshot = formatStateSnapshot();
        if (snapshot) process.stderr.write(snapshot + '\n');

        conversationHistory.push({ role: 'user', content: prompt });
        conversationHistory.push({ role: 'assistant', content: response });
      }

      process.stderr.write(`\nDone. Edit feedback-prompts.txt or PROMPT= and re-run.\n\n`);

      // Always passes — this is a development tool, not a CI gate
    },
    3_600_000 // 1 hour max — complex multi-turn sessions can take 20-30+ min
  );
});
