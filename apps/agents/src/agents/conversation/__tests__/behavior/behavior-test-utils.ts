/**
 * Behavior Test Utilities
 *
 * Provides mocked services and utilities for behavior testing.
 * Uses vi.hoisted() pattern for proper ESM module mocking.
 */

import { vi } from 'vitest';
import type { TestContext } from './test-cases.js';

// =============================================================================
// MOCK FACTORIES (used with vi.hoisted)
// =============================================================================

/**
 * Creates mock SupabaseService with default implementations
 */
export function createMockSupabaseService() {
  return {
    // Profile
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      timezone: 'America/New_York',
      email: 'test@example.com',
      name: 'Test User',
    }),

    // Events
    getEvents: vi.fn().mockResolvedValue([]),
    getEventsForAgent: vi.fn().mockResolvedValue([]),
    createEvent: vi.fn().mockImplementation(async (userId, event) => ({
      id: `evt-${Date.now()}`,
      user_id: userId,
      ...event,
      created_at: new Date().toISOString(),
    })),
    updateEvent: vi.fn().mockImplementation(async (userId, eventId, updates) => ({
      id: eventId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteEvent: vi.fn().mockResolvedValue({ success: true }),

    // Tasks
    getTasks: vi.fn().mockResolvedValue([]),
    createTask: vi.fn().mockImplementation(async (userId, task) => ({
      id: `task-${Date.now()}`,
      user_id: userId,
      ...task,
      status: 'pending',
      created_at: new Date().toISOString(),
    })),
    updateTask: vi.fn().mockImplementation(async (userId, taskId, updates) => ({
      id: taskId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteTask: vi.fn().mockResolvedValue({ success: true }),
    completeTask: vi.fn().mockImplementation(async (userId, taskId) => ({
      id: taskId,
      user_id: userId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })),

    // Goals
    getGoals: vi.fn().mockResolvedValue([]),
    createGoal: vi.fn().mockImplementation(async (userId, goal) => ({
      id: `goal-${Date.now()}`,
      user_id: userId,
      ...goal,
      status: 'in_progress',
      created_at: new Date().toISOString(),
    })),
    updateGoal: vi.fn().mockImplementation(async (userId, goalId, updates) => ({
      id: goalId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteGoal: vi.fn().mockResolvedValue({ success: true }),
    addGoalCheckIn: vi.fn().mockImplementation(async (userId, goalId, checkIn) => ({
      id: `checkin-${Date.now()}`,
      goal_id: goalId,
      ...checkIn,
      created_at: new Date().toISOString(),
    })),
    getGoalCheckIns: vi.fn().mockResolvedValue([]),

    // Aspects
    getAspects: vi.fn().mockResolvedValue([
      { id: 'cat-default-1', name: 'Work', color: '#4285f4' },
      { id: 'cat-default-2', name: 'Personal', color: '#34a853' },
    ]),

    // Settings
    getUserSettings: vi.fn().mockResolvedValue({}),
    updateUserSetting: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Creates mock RuleService with default implementations
 */
export function createMockRuleService() {
  return {
    getRules: vi.fn().mockResolvedValue([]),
    getEnabledRules: vi.fn().mockResolvedValue([]),
    getRule: vi.fn().mockResolvedValue(null),
    createRule: vi.fn().mockImplementation(async (userId, input) => ({
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
    updateRule: vi.fn().mockImplementation(async (userId, ruleId, updates) => ({
      id: ruleId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteRule: vi.fn().mockResolvedValue({ success: true }),
    toggleRule: vi.fn().mockImplementation(async (userId, ruleId, enabled) => ({
      id: ruleId,
      user_id: userId,
      enabled,
      updated_at: new Date().toISOString(),
    })),
    searchRules: vi.fn().mockResolvedValue([]),
    formatRulesForPrompt: vi.fn().mockReturnValue(''),
  };
}

/**
 * Creates mock MemoryService with default implementations
 */
export function createMockMemoryService() {
  return {
    getUserContext: vi.fn().mockResolvedValue(''),
    persistConversation: vi.fn().mockResolvedValue(undefined),
    searchFacts: vi.fn().mockResolvedValue([]),
    addFact: vi.fn().mockResolvedValue(undefined),
    addFacts: vi.fn().mockResolvedValue(undefined),
    invalidateFacts: vi.fn().mockResolvedValue(undefined),
    seedOnboardingData: vi.fn().mockResolvedValue(undefined),
    rebuildUserContext: vi.fn().mockResolvedValue(''),
  };
}

/**
 * Creates mock AspectService with default implementations
 */
export function createMockAspectService() {
  return {
    getAspects: vi.fn().mockResolvedValue([
      { id: 'asp-default-1', name: 'Work', color: '#4285f4' },
      { id: 'asp-default-2', name: 'Personal', color: '#34a853' },
    ]),
    getAspectByName: vi.fn().mockResolvedValue(null),
    createAspect: vi.fn().mockImplementation(async (userId, input) => ({
      id: `asp-${Date.now()}`,
      user_id: userId,
      name: input.name || input,
      color: input.color || '#808080',
      created_at: new Date().toISOString(),
    })),
    updateAspect: vi.fn().mockImplementation(async (userId, aspectId, updates) => ({
      id: aspectId,
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })),
    deleteAspect: vi.fn().mockResolvedValue({ success: true }),
  };
}

// =============================================================================
// CONTEXT CONFIGURATION
// =============================================================================

/**
 * Configures mocks based on test context
 */
export function configureMocksFromContext(
  context: TestContext | undefined,
  mocks: {
    supabaseService: ReturnType<typeof createMockSupabaseService>;
    ruleService: ReturnType<typeof createMockRuleService>;
    aspectService: ReturnType<typeof createMockAspectService>;
  }
) {
  if (!context) return;

  // Configure existing events
  if (context.existingEvents) {
    mocks.supabaseService.getEvents.mockResolvedValue(context.existingEvents);
    mocks.supabaseService.getEventsForAgent.mockResolvedValue(context.existingEvents);
  }

  // Configure existing tasks
  if (context.existingTasks) {
    mocks.supabaseService.getTasks.mockResolvedValue(context.existingTasks);
  }

  // Configure existing goals
  if (context.existingGoals) {
    mocks.supabaseService.getGoals.mockResolvedValue(context.existingGoals);
  }

  // Configure existing rules
  if (context.existingRules) {
    mocks.ruleService.getRules.mockResolvedValue(context.existingRules);
    mocks.ruleService.getEnabledRules.mockResolvedValue(
      context.existingRules.filter(r => r.enabled)
    );
    mocks.ruleService.formatRulesForPrompt.mockReturnValue(
      context.existingRules
        .map(r => `- [${r.enabled ? 'ENABLED' : 'DISABLED'}] ${r.rule_text} (ID: ${r.id})`)
        .join('\n')
    );
    // Mock getRule to return specific rule by ID
    mocks.ruleService.getRule.mockImplementation(async (userId, ruleId) => {
      return context.existingRules?.find(r => r.id === ruleId) || null;
    });
  }

  // Configure existing categories/aspects
  if (context.existingCategories) {
    mocks.supabaseService.getAspects.mockResolvedValue(context.existingCategories);
    mocks.aspectService.getAspects.mockResolvedValue(context.existingCategories);

    // Mock getAspectByName to check against existing aspects
    mocks.aspectService.getAspectByName.mockImplementation(async (userId, name) => {
      const normalized = name.toLowerCase().trim();
      return context.existingCategories?.find(
        c => c.name.toLowerCase().trim() === normalized
      ) || null;
    });
  }
}

// =============================================================================
// TOOL CALL TRACKING
// =============================================================================

export interface CapturedToolCall {
  name: string;
  args: Record<string, any>;
  result?: any;
  error?: Error;
  timestamp: number;
  order: number;
}

/**
 * Creates a tool call tracker that wraps tools to capture invocations
 */
export function createToolCallTracker() {
  const calls: CapturedToolCall[] = [];
  let callOrder = 0;

  return {
    /**
     * Get all captured tool calls
     */
    getCalls(): CapturedToolCall[] {
      return [...calls];
    },

    /**
     * Get tool calls by name
     */
    getCallsByName(name: string): CapturedToolCall[] {
      return calls.filter(c => c.name === name);
    },

    /**
     * Check if a tool was called
     */
    wasCalled(name: string): boolean {
      return calls.some(c => c.name === name);
    },

    /**
     * Get the number of times a tool was called
     */
    getCallCount(name: string): number {
      return calls.filter(c => c.name === name).length;
    },

    /**
     * Record a tool call
     */
    recordCall(name: string, args: Record<string, any>, result?: any, error?: Error) {
      calls.push({
        name,
        args,
        result,
        error,
        timestamp: Date.now(),
        order: callOrder++,
      });
    },

    /**
     * Clear all recorded calls
     */
    clear() {
      calls.length = 0;
      callOrder = 0;
    },

    /**
     * Get formatted summary of calls
     */
    getSummary(): string {
      if (calls.length === 0) {
        return 'No tool calls recorded';
      }

      return calls
        .map((c, i) => {
          const argsStr = JSON.stringify(c.args, null, 2);
          const resultStr = c.error
            ? `ERROR: ${c.error.message}`
            : c.result
              ? `Result: ${JSON.stringify(c.result).slice(0, 100)}...`
              : 'No result';
          return `${i + 1}. ${c.name}(${argsStr})\n   ${resultStr}`;
        })
        .join('\n\n');
    },
  };
}

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Creates a test user context
 */
export function createTestContext(overrides?: Partial<{
  userId: string;
  sessionId: string;
  timezone: string;
  conversationHistory: Array<{ role: string; content: string }>;
}>) {
  return {
    userId: overrides?.userId || 'test-user-id',
    sessionId: overrides?.sessionId || 'test-session-id',
    timezone: overrides?.timezone || 'America/New_York',
    conversationHistory: overrides?.conversationHistory || [],
  };
}

/**
 * Gets tomorrow's date in ISO format for the given timezone
 */
export function getTomorrowDate(timezone: string = 'America/New_York'): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Generates a timestamp for a specific time tomorrow
 */
export function getTomorrowAt(
  hour: number,
  minute: number = 0,
  timezone: string = 'America/New_York'
): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hour, minute, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Wait helper for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await wait(delayMs);
      }
    }
  }

  throw lastError;
}
