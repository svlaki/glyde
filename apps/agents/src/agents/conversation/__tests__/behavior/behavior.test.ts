/**
 * Behavior Test Suite for ConversationAgent
 *
 * This test suite validates that the ConversationAgent makes correct tool calls
 * for various user prompts. It uses real LLM calls with mocked database services.
 *
 * Run specific test:   npm test -- --grep "cal-create-001"
 * Run category:        npm test -- --grep "calendar-create"
 * Run all behavior:    npm test -- behavior.test.ts
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// =============================================================================
// HOISTED MOCKS - Must be at top level before any imports
// =============================================================================

// Stateful mock data - allows delete operations to actually remove items
const mockState = {
  events: [] as any[],
  tasks: [] as any[],
  goals: [] as any[],
  categories: [
    { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
    { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
  ] as any[],
  rules: [] as any[],
};

const {
  mockSupabaseService,
  mockRuleService,
  mockZepMemoryService,
  mockZepGraphService,
  mockCategoryService,
} = vi.hoisted(() => {
  // Create mock factories inline to avoid import issues
  const mockSupabaseService = {
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      timezone: 'America/New_York',
      email: 'test@example.com',
      name: 'Test User',
    }),
    getEvents: vi.fn().mockImplementation(async () => mockState.events),
    getEventsForAgent: vi.fn().mockImplementation(async () => mockState.events),
    createEvent: vi.fn().mockImplementation(async (userId: string, event: any) => {
      const newEvent = {
        id: `evt-${Date.now()}`,
        user_id: userId,
        ...event,
        created_at: new Date().toISOString(),
      };
      mockState.events.push(newEvent);
      return newEvent;
    }),
    updateEvent: vi.fn().mockImplementation(async (userId: string, eventId: string, updates: any) => {
      const index = mockState.events.findIndex(e => e.id === eventId);
      if (index !== -1) {
        mockState.events[index] = { ...mockState.events[index], ...updates, updated_at: new Date().toISOString() };
        return mockState.events[index];
      }
      return { id: eventId, user_id: userId, ...updates, updated_at: new Date().toISOString() };
    }),
    deleteEvent: vi.fn().mockImplementation(async (_userId: string, eventId: string) => {
      const index = mockState.events.findIndex(e => e.id === eventId);
      if (index !== -1) {
        mockState.events.splice(index, 1);
      }
      return { success: true };
    }),
    createRecurringEvent: vi.fn().mockImplementation(async (userId: string, event: any) => {
      const newEvent = {
        id: `recurring-evt-${Date.now()}`,
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
      const index = mockState.events.findIndex(e => e.id === eventId);
      if (index !== -1) {
        mockState.events.splice(index, 1);
      }
      return { success: true };
    }),
    getTasks: vi.fn().mockImplementation(async () => mockState.tasks),
    createTask: vi.fn().mockImplementation(async (userId: string, task: any) => {
      const newTask = {
        id: `task-${Date.now()}`,
        user_id: userId,
        ...task,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      mockState.tasks.push(newTask);
      return newTask;
    }),
    updateTask: vi.fn().mockResolvedValue({}),
    deleteTask: vi.fn().mockImplementation(async (_userId: string, taskId: string) => {
      const index = mockState.tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        mockState.tasks.splice(index, 1);
      }
      return { success: true };
    }),
    completeTask: vi.fn().mockResolvedValue({}),
    getGoals: vi.fn().mockImplementation(async () => mockState.goals),
    createGoal: vi.fn().mockImplementation(async (userId: string, goal: any) => {
      const newGoal = {
        id: `goal-${Date.now()}`,
        user_id: userId,
        ...goal,
        status: 'in_progress',
        created_at: new Date().toISOString(),
      };
      mockState.goals.push(newGoal);
      return newGoal;
    }),
    updateGoal: vi.fn().mockResolvedValue({}),
    deleteGoal: vi.fn().mockImplementation(async (_userId: string, goalId: string) => {
      const index = mockState.goals.findIndex(g => g.id === goalId);
      if (index !== -1) {
        mockState.goals.splice(index, 1);
      }
      return { success: true };
    }),
    addGoalCheckIn: vi.fn().mockResolvedValue({}),
    getGoalCheckIns: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockImplementation(async () => mockState.categories),
    getExpandedEvents: vi.fn().mockImplementation(async () => mockState.events),
    getUserSettings: vi.fn().mockResolvedValue({}),
    updateUserSetting: vi.fn().mockResolvedValue(true),
  };

  const mockRuleService = {
    getRules: vi.fn().mockResolvedValue([]),
    getEnabledRules: vi.fn().mockResolvedValue([]),
    getRule: vi.fn().mockResolvedValue(null),
    createRule: vi.fn().mockImplementation(async (userId: string, input: any) => ({
      id: `rule-${Date.now()}`,
      user_id: userId,
      rule_text: input.rule_text,
      description: input.description || null,
      enabled: true,
      priority: input.priority || 5,
      source: input.source || 'manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    updateRule: vi.fn().mockResolvedValue({}),
    deleteRule: vi.fn().mockResolvedValue({ success: true }),
    toggleRule: vi.fn().mockImplementation(async (_userId: string, ruleId: string, enabled: boolean) => {
      // Update the rule in mockState
      const index = mockState.rules.findIndex((r: any) => r.id === ruleId);
      if (index !== -1) {
        mockState.rules[index] = { ...mockState.rules[index], enabled, updated_at: new Date().toISOString() };
        return mockState.rules[index];
      }
      return {
        id: ruleId,
        enabled,
        updated_at: new Date().toISOString(),
      };
    }),
    searchRules: vi.fn().mockResolvedValue([]),
    formatRulesForPrompt: vi.fn().mockReturnValue(''),
  };

  const mockZepMemoryService = {
    getOrCreateSession: vi.fn().mockResolvedValue('test-session-id'),
    getThreadContext: vi.fn().mockResolvedValue(''),
    addUserMessage: vi.fn().mockResolvedValue(undefined),
    addAssistantMessage: vi.fn().mockResolvedValue(undefined),
    addConversation: vi.fn().mockResolvedValue(undefined),
    initUser: vi.fn().mockResolvedValue(undefined),
    getMemoryContext: vi.fn().mockResolvedValue({
      shortTerm: {
        sessionId: 'test-session-id',
        messages: [],
        context: '',
        lastUpdated: new Date().toISOString(),
      },
      longTerm: {
        userId: 'test-user-id',
        profile: { id: 'test-user-id', email: '', timezone: '', preferences: {} },
        preferences: {},
        goals: [],
        insights: [],
        lastUpdated: new Date().toISOString(),
      },
      entity: { entities: {}, relationships: {} },
      vector: { recentEvents: [], recentChats: [], semanticContext: '' },
    }),
  };

  const mockZepGraphService = {
    addCalendarEvent: vi.fn().mockResolvedValue('graph-event-id'),
    updateCalendarEvent: vi.fn().mockResolvedValue(undefined),
    deleteCalendarEvent: vi.fn().mockResolvedValue(undefined),
    addTask: vi.fn().mockResolvedValue('graph-task-id'),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    addGoal: vi.fn().mockResolvedValue('graph-goal-id'),
    deleteGoal: vi.fn().mockResolvedValue(undefined),
    searchUserGraphAdvanced: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    getEnhancedUserContext: vi.fn().mockResolvedValue({}),
    searchEntities: vi.fn().mockResolvedValue([]),
    searchEvents: vi.fn().mockResolvedValue([]),
    searchTasks: vi.fn().mockResolvedValue([]),
  };

  const mockCategoryService = {
    getCategories: vi.fn().mockImplementation(async () => mockState.categories),
    getCategoryByName: vi.fn().mockResolvedValue(null),
    createCategory: vi.fn().mockImplementation(async (userId: string, nameOrInput: string | any, color?: string) => {
      // Handle both (userId, name, color) and (userId, {name, color, ...}) signatures
      const categoryName = typeof nameOrInput === 'object' ? nameOrInput.name : nameOrInput;
      const categoryColor = typeof nameOrInput === 'object' ? nameOrInput.color : color;
      const newCategory = {
        id: `cat-${Date.now()}`,
        user_id: userId,
        name: categoryName,
        color: categoryColor || '#808080',
        created_at: new Date().toISOString(),
      };
      mockState.categories.push(newCategory);
      return newCategory;
    }),
    updateCategory: vi.fn().mockResolvedValue({}),
    deleteCategory: vi.fn().mockImplementation(async (_userId: string, categoryId: string) => {
      const index = mockState.categories.findIndex((c: any) => c.id === categoryId);
      if (index !== -1) {
        mockState.categories.splice(index, 1);
      }
      return { success: true };
    }),
  };

  return {
    mockSupabaseService,
    mockRuleService,
    mockZepMemoryService,
    mockZepGraphService,
    mockCategoryService,
  };
});

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock('../../../../services/SupabaseService.js', () => ({
  initializeSupabase: vi.fn(),
  SupabaseService: vi.fn(() => mockSupabaseService),
  getSupabaseService: () => mockSupabaseService,
  getSupabaseClient: () => ({ auth: { getUser: vi.fn() } }),
  supabase: { auth: { getUser: vi.fn() } },
}));

vi.mock('../../../../services/RuleService.js', () => ({
  default: mockRuleService,
  RuleService: vi.fn(() => mockRuleService),
}));

vi.mock('../../../../services/ZepMemoryService.js', () => ({
  ZepMemoryService: vi.fn(() => mockZepMemoryService),
}));

vi.mock('../../../../services/ZepGraphService.js', () => ({
  ZepGraphService: vi.fn(() => mockZepGraphService),
}));

vi.mock('../../../../services/CategoryService.js', () => ({
  default: mockCategoryService,
  CategoryService: vi.fn(() => mockCategoryService),
}));

// Mock Zep sync helper
vi.mock('../../../../utils/zep-sync-helper.js', () => ({
  executeZepOperation: vi.fn().mockResolvedValue(undefined),
}));

// Mock environment variables
vi.mock('../../../../utils/env.js', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-openai-key',
    PORT: 8000,
    NODE_ENV: 'test',
    ZEP_API_KEY: 'test-zep-key',
  },
  isDevelopment: false,
  ENV_PATH: '/test/.env',
}));

// =============================================================================
// IMPORTS (after mocks)
// =============================================================================

import { ConversationAgent } from '../../ConversationAgent.js';
import {
  behaviorTestCases,
  getRunnableTestCases,
  getAllCategories,
  type TestContext,
} from './test-cases.js';
import {
  runBehaviorTest,
  formatTestResult,
  type CapturedToolCall,
} from './behavior-test-runner.js';

// =============================================================================
// TEST SETUP
// =============================================================================

let agent: ConversationAgent;

/**
 * Configures mocks based on test context
 * Populates mockState arrays so stateful operations work correctly
 */
function configureMocksFromContext(context: TestContext | undefined) {
  if (!context) return;

  if (context.existingEvents) {
    // Populate mockState with existing events
    mockState.events = [...context.existingEvents];
  }

  if (context.existingTasks) {
    mockState.tasks = [...context.existingTasks];
  }

  if (context.existingGoals) {
    mockState.goals = [...context.existingGoals];
  }

  if (context.existingRules) {
    mockState.rules = [...context.existingRules];
    mockRuleService.getRules.mockImplementation(async () => mockState.rules);
    mockRuleService.getEnabledRules.mockImplementation(async () =>
      mockState.rules.filter((r: any) => r.enabled)
    );
    mockRuleService.formatRulesForPrompt.mockImplementation(() =>
      mockState.rules
        .map((r: any) => `- [${r.enabled ? 'ENABLED' : 'DISABLED'}] ${r.rule_text} (ID: ${r.id})`)
        .join('\n')
    );
    mockRuleService.getRule.mockImplementation(async (_userId: string, ruleId: string) => {
      return mockState.rules.find((r: any) => r.id === ruleId) || null;
    });
    mockRuleService.searchRules.mockImplementation(async (_userId: string, query: string) => {
      const q = query.toLowerCase();
      return mockState.rules.filter((r: any) =>
        r.rule_text.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    });
  }

  if (context.existingCategories) {
    mockState.categories = [...context.existingCategories];
    mockCategoryService.getCategoryByName.mockImplementation(async (_userId: string, name: string) => {
      const normalized = name.toLowerCase().trim();
      return mockState.categories.find(
        (c: any) => c.name.toLowerCase().trim() === normalized
      ) || null;
    });
  }
}

/**
 * Resets all mocks to default state
 */
function resetMocks() {
  // Reset mockState to defaults
  mockState.events = [];
  mockState.tasks = [];
  mockState.goals = [];
  mockState.categories = [
    { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
    { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
  ];
  mockState.rules = [];

  // Reset RuleService implementations to use mockState
  mockRuleService.getRules.mockImplementation(async () => mockState.rules);
  mockRuleService.getEnabledRules.mockImplementation(async () =>
    mockState.rules.filter((r: any) => r.enabled)
  );
  mockRuleService.formatRulesForPrompt.mockImplementation(() =>
    mockState.rules.length > 0
      ? mockState.rules
          .map((r: any) => `- [${r.enabled ? 'ENABLED' : 'DISABLED'}] ${r.rule_text} (ID: ${r.id})`)
          .join('\n')
      : ''
  );
  mockRuleService.getRule.mockImplementation(async (_userId: string, ruleId: string) => {
    return mockState.rules.find((r: any) => r.id === ruleId) || null;
  });
  mockRuleService.searchRules.mockImplementation(async (_userId: string, query: string) => {
    const q = query.toLowerCase();
    return mockState.rules.filter((r: any) =>
      r.rule_text.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  // Reset CategoryService to use mockState
  mockCategoryService.getCategoryByName.mockImplementation(async (_userId: string, name: string) => {
    const normalized = name.toLowerCase().trim();
    return mockState.categories.find(
      (c: any) => c.name.toLowerCase().trim() === normalized
    ) || null;
  });

  mockZepMemoryService.getThreadContext.mockResolvedValue('');
}

/**
 * Map service method calls to tool names
 */
const serviceMethodToToolMap: Record<string, string> = {
  // SupabaseService methods -> tool names
  'createEvent': 'create_event',
  'updateEvent': 'update_event',
  'deleteEvent': 'delete_event',
  'getEvents': 'list_events',
  'createTask': 'create_task',
  'updateTask': 'update_task',
  'deleteTask': 'delete_task',
  'completeTask': 'complete_task',
  'getTasks': 'list_tasks',
  'createGoal': 'create_goal',
  'updateGoal': 'update_goal',
  'deleteGoal': 'delete_goal',
  'getGoals': 'list_goals',
  'addGoalCheckIn': 'check_in_goal',
  'getCategories': 'list_categories',
  // CategoryService methods
  'createCategory': 'create_category',
  'updateCategory': 'update_category',
  'deleteCategory': 'delete_category',
  // RuleService methods
  'createRule': 'create_rule',
  'toggleRule': 'toggle_rule',
  'deleteRule': 'delete_rule',
  'getRules': 'list_rules',
};

/**
 * Extract tool calls from mock invocations
 */
function extractToolCallsFromMocks(): CapturedToolCall[] {
  const calls: CapturedToolCall[] = [];
  let order = 0;

  // Check SupabaseService mocks
  const supabaseMethods = [
    'createEvent', 'updateEvent', 'deleteEvent',
    'createTask', 'updateTask', 'deleteTask', 'completeTask',
    'createGoal', 'updateGoal', 'deleteGoal', 'addGoalCheckIn',
  ];

  for (const method of supabaseMethods) {
    const mock = (mockSupabaseService as any)[method];
    if (mock && mock.mock?.calls?.length > 0) {
      for (const callArgs of mock.mock.calls) {
        const toolName = serviceMethodToToolMap[method];
        if (toolName) {
          calls.push({
            name: toolName,
            args: callArgs.length > 1 ? callArgs[1] : callArgs[0],
            timestamp: Date.now(),
            order: order++,
          });
        }
      }
    }
  }

  // Check CategoryService mocks
  const categoryMethods = ['createCategory', 'updateCategory', 'deleteCategory', 'getCategories'];
  for (const method of categoryMethods) {
    const mock = (mockCategoryService as any)[method];
    if (mock && mock.mock?.calls?.length > 0) {
      for (const callArgs of mock.mock.calls) {
        const toolName = serviceMethodToToolMap[method];
        if (toolName) {
          let args: any;
          if (callArgs.length > 1) {
            // If the second arg is an object with 'name', it's already the full input
            if (typeof callArgs[1] === 'object' && callArgs[1] !== null && 'name' in callArgs[1]) {
              args = callArgs[1];
            } else {
              // Positional args: (userId, name, color)
              args = { name: callArgs[1], color: callArgs[2] };
            }
          } else {
            args = callArgs[0];
          }
          calls.push({
            name: toolName,
            args,
            timestamp: Date.now(),
            order: order++,
          });
        }
      }
    }
  }

  // Check RuleService mocks
  const ruleMethods = ['createRule', 'toggleRule', 'deleteRule', 'getRules'];
  for (const method of ruleMethods) {
    const mock = (mockRuleService as any)[method];
    if (mock && mock.mock?.calls?.length > 0) {
      for (const callArgs of mock.mock.calls) {
        const toolName = serviceMethodToToolMap[method];
        if (toolName) {
          // For toggleRule, args are (userId, ruleId, enabled)
          if (method === 'toggleRule') {
            calls.push({
              name: toolName,
              args: { rule_id: callArgs[1], enabled: callArgs[2] },
              timestamp: Date.now(),
              order: order++,
            });
          } else if (method === 'createRule') {
            calls.push({
              name: toolName,
              args: callArgs[1], // Second arg is the rule input
              timestamp: Date.now(),
              order: order++,
            });
          } else {
            calls.push({
              name: toolName,
              args: callArgs.length > 1 ? callArgs[1] : {},
              timestamp: Date.now(),
              order: order++,
            });
          }
        }
      }
    }
  }

  return calls;
}

/**
 * Execute a prompt through the agent and capture tool calls
 */
async function executePrompt(
  prompt: string
): Promise<{ response: string; calls: CapturedToolCall[] }> {
  // Clear all mocks before execution to track only this prompt's calls
  vi.clearAllMocks();

  const context = {
    userId: 'test-user-id',
    sessionId: 'test-session-id',
    timezone: 'America/New_York',
    conversationHistory: [],
  };

  try {
    const result = await agent.processMessage(context, prompt);

    // Extract tool calls from mock invocations
    const calls = extractToolCallsFromMocks();

    return {
      response: result.content,
      calls,
    };
  } catch (error) {
    console.error('Error executing prompt:', error);
    const calls = extractToolCallsFromMocks();
    return {
      response: `Error: ${error instanceof Error ? error.message : String(error)}`,
      calls,
    };
  }
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('ConversationAgent Behavior Tests', () => {
  beforeAll(async () => {
    // Initialize the agent
    agent = new ConversationAgent();
    await agent.initialize();

    console.log('Behavior test suite initialized');
  });

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Get all categories and create a describe block for each
  const categories = getAllCategories();

  for (const category of categories) {
    const categoryTests = behaviorTestCases.filter(tc => tc.category === category);

    if (categoryTests.length === 0) continue;

    describe(category, () => {
      for (const testCase of categoryTests) {
        // Handle skip/only flags
        const testFn = testCase.skip ? it.skip : testCase.only ? it.only : it;

        testFn(
          `[${testCase.id}] ${testCase.name}`,
          async () => {
            // Configure mocks based on test context
            configureMocksFromContext(testCase.context);

            // Run the test
            const result = await runBehaviorTest(testCase, executePrompt);

            // Log result for debugging
            console.log(formatTestResult(result));

            // Assert the test passed
            if (!result.passed) {
              const errorDetails = result.errors.join('\n  - ');
              const callsSummary = result.capturedCalls.length > 0
                ? `\nCaptured calls: ${result.capturedCalls.map(c => c.name).join(', ')}`
                : '\nNo tool calls captured';

              throw new Error(
                `Test failed:\n  - ${errorDetails}${callsSummary}\n\nResponse: ${result.response.slice(0, 200)}...`
              );
            }

            expect(result.passed).toBe(true);
          },
          // Extended timeout for LLM calls
          120000
        );
      }
    });
  }
});

// =============================================================================
// UTILITY TESTS
// =============================================================================

describe('Test Infrastructure', () => {
  it('should have test cases defined', () => {
    expect(behaviorTestCases.length).toBeGreaterThan(0);
    console.log(`Total test cases: ${behaviorTestCases.length}`);
  });

  it('should have unique test IDs', () => {
    const ids = behaviorTestCases.map(tc => tc.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all categories covered', () => {
    const categories = getAllCategories();
    expect(categories.length).toBeGreaterThan(0);
    console.log(`Categories: ${categories.join(', ')}`);
  });

  it('should get runnable test cases', () => {
    const runnable = getRunnableTestCases();
    expect(runnable.length).toBeGreaterThan(0);
    console.log(`Runnable test cases: ${runnable.length}`);
  });
});
