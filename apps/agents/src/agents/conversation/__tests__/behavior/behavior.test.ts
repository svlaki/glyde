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
    getEvents: vi.fn().mockResolvedValue([]),
    getEventsForAgent: vi.fn().mockResolvedValue([]),
    createEvent: vi.fn().mockImplementation(async (userId: string, event: any) => ({
      id: `evt-${Date.now()}`,
      user_id: userId,
      ...event,
      created_at: new Date().toISOString(),
    })),
    updateEvent: vi.fn().mockImplementation(async (userId: string, eventId: string, updates: any) => ({
      id: eventId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteEvent: vi.fn().mockResolvedValue({ success: true }),
    getTasks: vi.fn().mockResolvedValue([]),
    createTask: vi.fn().mockImplementation(async (userId: string, task: any) => ({
      id: `task-${Date.now()}`,
      user_id: userId,
      ...task,
      status: 'pending',
      created_at: new Date().toISOString(),
    })),
    updateTask: vi.fn().mockResolvedValue({}),
    deleteTask: vi.fn().mockResolvedValue({ success: true }),
    completeTask: vi.fn().mockResolvedValue({}),
    getGoals: vi.fn().mockResolvedValue([]),
    createGoal: vi.fn().mockImplementation(async (userId: string, goal: any) => ({
      id: `goal-${Date.now()}`,
      user_id: userId,
      ...goal,
      status: 'in_progress',
      created_at: new Date().toISOString(),
    })),
    updateGoal: vi.fn().mockResolvedValue({}),
    deleteGoal: vi.fn().mockResolvedValue({ success: true }),
    addGoalCheckIn: vi.fn().mockResolvedValue({}),
    getGoalCheckIns: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([
      { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
      { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
    ]),
    getExpandedEvents: vi.fn().mockResolvedValue([]),
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
    toggleRule: vi.fn().mockImplementation(async (_userId: string, ruleId: string, enabled: boolean) => ({
      id: ruleId,
      enabled,
      updated_at: new Date().toISOString(),
    })),
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
  };

  const mockCategoryService = {
    getCategories: vi.fn().mockResolvedValue([
      { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
      { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
    ]),
    getCategoryByName: vi.fn().mockResolvedValue(null),
    createCategory: vi.fn().mockImplementation(async (userId: string, name: string, color?: string) => ({
      id: `cat-${Date.now()}`,
      user_id: userId,
      name,
      color: color || '#808080',
      created_at: new Date().toISOString(),
    })),
    updateCategory: vi.fn().mockResolvedValue({}),
    deleteCategory: vi.fn().mockResolvedValue({ success: true }),
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
 */
function configureMocksFromContext(context: TestContext | undefined) {
  if (!context) return;

  if (context.existingEvents) {
    mockSupabaseService.getEvents.mockResolvedValue(context.existingEvents);
    mockSupabaseService.getEventsForAgent.mockResolvedValue(context.existingEvents);
    mockSupabaseService.getExpandedEvents.mockResolvedValue(context.existingEvents);
  }

  if (context.existingTasks) {
    mockSupabaseService.getTasks.mockResolvedValue(context.existingTasks);
  }

  if (context.existingGoals) {
    mockSupabaseService.getGoals.mockResolvedValue(context.existingGoals);
  }

  if (context.existingRules) {
    mockRuleService.getRules.mockResolvedValue(context.existingRules);
    mockRuleService.getEnabledRules.mockResolvedValue(
      context.existingRules.filter(r => r.enabled)
    );
    mockRuleService.formatRulesForPrompt.mockReturnValue(
      context.existingRules
        .map(r => `- [${r.enabled ? 'ENABLED' : 'DISABLED'}] ${r.rule_text} (ID: ${r.id})`)
        .join('\n')
    );
    mockRuleService.getRule.mockImplementation(async (_userId: string, ruleId: string) => {
      return context.existingRules?.find(r => r.id === ruleId) || null;
    });
  }

  if (context.existingCategories) {
    mockSupabaseService.getCategories.mockResolvedValue(context.existingCategories);
    mockCategoryService.getCategories.mockResolvedValue(context.existingCategories);
    mockCategoryService.getCategoryByName.mockImplementation(async (_userId: string, name: string) => {
      const normalized = name.toLowerCase().trim();
      return context.existingCategories?.find(
        c => c.name.toLowerCase().trim() === normalized
      ) || null;
    });
  }
}

/**
 * Resets all mocks to default state
 */
function resetMocks() {
  // Reset all mock implementations to defaults
  mockSupabaseService.getProfile.mockResolvedValue({
    id: 'test-user-id',
    timezone: 'America/New_York',
    email: 'test@example.com',
    name: 'Test User',
  });
  mockSupabaseService.getEvents.mockResolvedValue([]);
  mockSupabaseService.getEventsForAgent.mockResolvedValue([]);
  mockSupabaseService.getExpandedEvents.mockResolvedValue([]);
  mockSupabaseService.getTasks.mockResolvedValue([]);
  mockSupabaseService.getGoals.mockResolvedValue([]);
  mockSupabaseService.getCategories.mockResolvedValue([
    { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
    { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
  ]);

  mockRuleService.getRules.mockResolvedValue([]);
  mockRuleService.getEnabledRules.mockResolvedValue([]);
  mockRuleService.formatRulesForPrompt.mockReturnValue('');
  mockRuleService.getRule.mockResolvedValue(null);

  mockCategoryService.getCategories.mockResolvedValue([
    { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
    { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
  ]);
  mockCategoryService.getCategoryByName.mockResolvedValue(null);

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
          calls.push({
            name: toolName,
            args: callArgs.length > 1 ? { name: callArgs[1], color: callArgs[2] } : callArgs[0],
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
