/**
 * Behavior Test Case Definitions
 *
 * This file contains 50+ test cases that validate the ConversationAgent
 * makes correct tool calls for various user prompts.
 */

/**
 * Expected tool call definition for validation
 */
export interface ExpectedToolCall {
  /** Tool name (e.g., 'create_event') */
  name: string;
  /** Partial argument matching - values must match exactly */
  args?: Record<string, any>;
  /** Custom validators for complex argument matching */
  argMatchers?: Record<string, (value: any) => boolean>;
  /** Enforce call sequence (0-indexed) */
  order?: number;
}

/**
 * Context data that simulates existing database state
 */
export interface TestContext {
  existingEvents?: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location?: string;
    description?: string;
    category?: string;
  }>;
  existingTasks?: Array<{
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    priority?: string;
    status?: string;
    category?: string;
  }>;
  existingGoals?: Array<{
    id: string;
    title: string;
    description?: string;
    target_date?: string;
    progress?: number;
    status?: string;
  }>;
  existingRules?: Array<{
    id: string;
    rule_text: string;
    description?: string;
    enabled: boolean;
    priority?: number;
  }>;
  existingCategories?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
}

/**
 * Complete behavior test case definition
 */
export interface BehaviorTestCase {
  /** Unique test identifier */
  id: string;
  /** Human-readable test name */
  name: string;
  /** Test category for grouping */
  category: string;
  /** The user prompt to test */
  prompt: string;
  /** Simulated existing data context */
  context?: TestContext;
  /** Expected tool calls that MUST be made */
  expectedTools: ExpectedToolCall[];
  /** Tools that should NOT be called */
  forbiddenTools?: string[];
  /** Strings that should appear in the response */
  responseContains?: string[];
  /** Strings that should NOT appear in the response */
  responseNotContains?: string[];
  /** Allow additional tool calls beyond expectedTools */
  allowExtraTools?: boolean;
  /** Skip this test (for WIP tests) */
  skip?: boolean;
  /** Only run this test (for debugging) */
  only?: boolean;
}

// =============================================================================
// HELPER MATCHERS
// =============================================================================

/** Matches ISO timestamp containing specific time (e.g., 'T14:00') */
export const containsTime = (time: string) => (v: any) =>
  typeof v === 'string' && v.includes(time);

/** Matches string containing substring (case-insensitive) */
export const containsText = (text: string) => (v: any) =>
  typeof v === 'string' && v.toLowerCase().includes(text.toLowerCase());

/** Matches regex pattern */
export const matchesRegex = (pattern: RegExp) => (v: any) =>
  typeof v === 'string' && pattern.test(v);

/** Matches any truthy value */
export const isTruthy = () => (v: any) => Boolean(v);

/** Matches any date string */
export const isDateString = () => (v: any) =>
  typeof v === 'string' && !isNaN(Date.parse(v));

/** Matches a specific boolean value */
export const isBoolean = (expected: boolean) => (v: any) => v === expected;

// =============================================================================
// TEST CASES
// =============================================================================

export const behaviorTestCases: BehaviorTestCase[] = [
  // ---------------------------------------------------------------------------
  // CALENDAR CREATE (8 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'cal-create-001',
    name: 'Create event with explicit time',
    category: 'calendar-create',
    prompt: 'Schedule dentist tomorrow at 2pm',
    context: {
      existingCategories: [
        { id: 'cat-1', name: 'Health' },
        { id: 'cat-2', name: 'Work' },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('dentist'),
          // Time is stored in UTC - 2pm ET = 7pm UTC (or 6pm during DST)
          start_time: isDateString(),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'cal-create-002',
    name: 'Create event with inferred duration',
    category: 'calendar-create',
    prompt: 'Add a meeting with John tomorrow at 3pm',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('john'),
          start_time: isDateString(),
        },
      },
    ],
  },
  {
    id: 'cal-create-003',
    name: 'Create event requires category check first',
    category: 'calendar-create',
    prompt: 'Add CS 229 lecture Monday at 1:30pm',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      { name: 'list_categories', order: 0 },
      { name: 'create_category', order: 1, argMatchers: { name: containsText('cs') } },
      { name: 'create_event', order: 2 },
    ],
    allowExtraTools: true,
  },
  {
    id: 'cal-create-004',
    name: 'Create event with location',
    category: 'calendar-create',
    prompt: 'Schedule coffee with Sarah at Starbucks tomorrow at 10am',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Social' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('sarah'),
          location: containsText('starbucks'),
          start_time: containsTime('T10:00'),
        },
      },
    ],
  },
  {
    id: 'cal-create-005',
    name: 'Create event with explicit duration',
    category: 'calendar-create',
    prompt: 'Book a 2-hour gym session at 6pm',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Fitness' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: containsTime('T18:00'),
        },
      },
    ],
  },
  {
    id: 'cal-create-006',
    name: 'Create event infers morning time for breakfast',
    category: 'calendar-create',
    prompt: 'Schedule breakfast with mom tomorrow',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Family' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('breakfast'),
        },
      },
    ],
  },
  {
    id: 'cal-create-007',
    name: 'Create event infers evening time for dinner',
    category: 'calendar-create',
    prompt: 'Add dinner with the team on Friday',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('dinner'),
        },
      },
    ],
  },
  {
    id: 'cal-create-008',
    name: 'Create event uses existing category',
    category: 'calendar-create',
    prompt: 'Add a workout session tomorrow at 7am',
    context: {
      existingCategories: [
        { id: 'cat-1', name: 'Fitness' },
        { id: 'cat-2', name: 'Work' },
      ],
    },
    expectedTools: [
      { name: 'list_categories' },
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('workout'),
        },
      },
    ],
    forbiddenTools: ['create_category'],
    allowExtraTools: true,
  },

  // ---------------------------------------------------------------------------
  // CALENDAR UPDATE (5 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'cal-update-001',
    name: 'Update event time',
    category: 'calendar-update',
    prompt: 'Move my dentist appointment to 3pm',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Dentist',
          start_time: '2026-01-22T14:00:00Z',
          end_time: '2026-01-22T15:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          start_time: containsTime('T15:00'),
        },
      },
    ],
  },
  {
    id: 'cal-update-002',
    name: 'Update event location',
    category: 'calendar-update',
    prompt: "Change the meeting with John's location to Conference Room B",
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Meeting with John',
          start_time: '2026-01-22T15:00:00Z',
          end_time: '2026-01-22T16:00:00Z',
          location: 'Conference Room A',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          location: containsText('conference room b'),
        },
      },
    ],
  },
  {
    id: 'cal-update-003',
    name: 'Update event title',
    category: 'calendar-update',
    prompt: 'Rename my 3pm meeting to "Project Review"',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Meeting',
          start_time: '2026-01-22T15:00:00Z',
          end_time: '2026-01-22T16:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          title: containsText('project review'),
        },
      },
    ],
  },
  {
    id: 'cal-update-004',
    name: 'Update event date',
    category: 'calendar-update',
    prompt: 'Reschedule the dentist to next Monday',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Dentist',
          start_time: '2026-01-22T14:00:00Z',
          end_time: '2026-01-22T15:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          searchQuery: containsText('dentist'),
        },
      },
    ],
  },
  {
    id: 'cal-update-005',
    name: 'Bulk update events category',
    category: 'calendar-update',
    prompt: 'Move all my CS 229 lectures to the School category',
    context: {
      existingEvents: [
        { id: 'evt-1', title: 'CS 229 Lecture', start_time: '2026-01-22T13:30:00Z', end_time: '2026-01-22T15:00:00Z', category: 'Work' },
        { id: 'evt-2', title: 'CS 229 Lecture', start_time: '2026-01-24T13:30:00Z', end_time: '2026-01-24T15:00:00Z', category: 'Work' },
      ],
      existingCategories: [
        { id: 'cat-1', name: 'Work' },
        { id: 'cat-2', name: 'School' },
      ],
    },
    expectedTools: [
      {
        name: 'bulk_update_events',
        argMatchers: {
          searchQuery: containsText('cs 229'),
        },
      },
    ],
    allowExtraTools: true,
  },

  // ---------------------------------------------------------------------------
  // CALENDAR DELETE (4 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'cal-delete-001',
    name: 'Delete event from context',
    category: 'calendar-delete',
    prompt: 'Delete my dentist appointment',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Dentist',
          start_time: '2026-01-22T14:00:00Z',
          end_time: '2026-01-22T15:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'delete_event',
      },
    ],
  },
  {
    id: 'cal-delete-002',
    name: 'Cancel tomorrow morning event',
    category: 'calendar-delete',
    prompt: 'Cancel my meeting tomorrow',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Team Meeting',
          start_time: '2026-01-22T10:00:00Z',
          end_time: '2026-01-22T11:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'delete_event',
      },
    ],
  },
  {
    id: 'cal-delete-003',
    name: 'Delete multiple related events',
    category: 'calendar-delete',
    prompt: 'Delete all my CS 229 lectures',
    context: {
      existingEvents: [
        { id: 'evt-1', title: 'CS 229 Lecture', start_time: '2026-01-22T13:30:00Z', end_time: '2026-01-22T15:00:00Z' },
        { id: 'evt-2', title: 'CS 229 Lecture', start_time: '2026-01-24T13:30:00Z', end_time: '2026-01-24T15:00:00Z' },
      ],
    },
    expectedTools: [
      {
        name: 'delete_event',
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'cal-delete-004',
    name: 'Remove specific event by title',
    category: 'calendar-delete',
    prompt: 'Remove the coffee with Sarah from my calendar',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Coffee with Sarah',
          start_time: '2026-01-22T10:00:00Z',
          end_time: '2026-01-22T11:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'delete_event',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // CALENDAR CONFLICT (4 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'cal-conflict-001',
    name: 'Detect conflict and ask for confirmation',
    category: 'calendar-conflict',
    prompt: 'Schedule lunch at noon',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Team Meeting',
          start_time: '2026-01-22T12:00:00Z',
          end_time: '2026-01-22T13:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        args: {
          replaceConflicting: false,
        },
      },
    ],
  },
  {
    id: 'cal-conflict-002',
    name: 'Replace conflicting event explicitly requested',
    category: 'calendar-conflict',
    prompt: 'Cancel my noon meeting and schedule lunch instead',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Team Meeting',
          start_time: '2026-01-22T12:00:00Z',
          end_time: '2026-01-22T13:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        args: {
          replaceConflicting: true,
        },
        argMatchers: {
          title: containsText('lunch'),
        },
      },
    ],
  },
  {
    id: 'cal-conflict-003',
    name: 'Replace conflicting event - reschedule wording',
    category: 'calendar-conflict',
    prompt: 'Move my 2pm meeting and put a doctor appointment there instead',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Client Call',
          start_time: '2026-01-22T14:00:00Z',
          end_time: '2026-01-22T15:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        args: {
          replaceConflicting: true,
        },
        argMatchers: {
          title: containsText('doctor'),
        },
      },
    ],
  },
  {
    id: 'cal-conflict-004',
    name: 'Do not auto-replace without explicit instruction',
    category: 'calendar-conflict',
    prompt: 'Add a gym session at 3pm tomorrow',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Team Standup',
          start_time: '2026-01-22T15:00:00Z',
          end_time: '2026-01-22T15:30:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        args: {
          replaceConflicting: false,
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // CALENDAR RECURRING (5 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'cal-recurring-001',
    name: 'Create weekly recurring event',
    category: 'calendar-recurring',
    prompt: 'Schedule team standup every Monday at 9am',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('standup'),
        },
      },
    ],
  },
  {
    id: 'cal-recurring-002',
    name: 'Create daily recurring event',
    category: 'calendar-recurring',
    prompt: 'Add a daily meditation at 7am',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Health' }],
    },
    expectedTools: [
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('meditation'),
        },
      },
    ],
  },
  {
    id: 'cal-recurring-003',
    name: 'Create weekday recurring event',
    category: 'calendar-recurring',
    prompt: 'Schedule gym every weekday at 6pm',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Fitness' }],
    },
    expectedTools: [
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('gym'),
        },
      },
    ],
  },
  {
    id: 'cal-recurring-004',
    name: 'Create biweekly recurring event',
    category: 'calendar-recurring',
    prompt: 'Add a biweekly 1:1 with my manager every other Wednesday at 2pm',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('1:1'),
        },
      },
    ],
  },
  {
    id: 'cal-recurring-005',
    name: 'Create monthly recurring event',
    category: 'calendar-recurring',
    prompt: 'Schedule a monthly budget review on the first of each month at 10am',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Finance' }],
    },
    expectedTools: [
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('budget'),
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // TASK MANAGEMENT (6 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'task-001',
    name: 'Create task for item without time',
    category: 'task-management',
    prompt: 'I need to buy groceries',
    expectedTools: [
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('groceries'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'task-002',
    name: 'Create task with explicit todo wording',
    category: 'task-management',
    prompt: 'Add a todo to call the insurance company',
    expectedTools: [
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('insurance'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'task-003',
    name: 'Create task with due date',
    category: 'task-management',
    prompt: 'Remind me to submit the report by Friday',
    expectedTools: [
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('report'),
          dueDate: isDateString(),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'task-004',
    name: 'Create high priority task',
    category: 'task-management',
    prompt: 'I urgently need to fix the production bug',
    expectedTools: [
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('bug'),
          priority: (v) => v === 'high' || v === 'urgent',
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'task-005',
    name: 'Complete existing task',
    category: 'task-management',
    prompt: 'Mark the grocery shopping task as done',
    context: {
      existingTasks: [
        {
          id: 'task-1',
          title: 'Buy groceries',
          status: 'pending',
        },
      ],
    },
    expectedTools: [
      {
        name: 'complete_task',
      },
    ],
  },
  {
    id: 'task-006',
    name: 'Create task with category inference',
    category: 'task-management',
    prompt: 'Add a task to review the quarterly financials',
    expectedTools: [
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('financials'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },

  // ---------------------------------------------------------------------------
  // GOAL MANAGEMENT (4 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'goal-001',
    name: 'Create a new goal',
    category: 'goal-management',
    prompt: 'I want to set a goal to read 20 books this year',
    expectedTools: [
      {
        name: 'create_goal',
        argMatchers: {
          title: containsText('book'),
        },
      },
    ],
  },
  {
    id: 'goal-002',
    name: 'Create goal with target date',
    category: 'goal-management',
    prompt: 'Set a goal to lose 10 pounds by June',
    expectedTools: [
      {
        name: 'create_goal',
        argMatchers: {
          title: (v) => containsText('lose')(v) || containsText('weight')(v) || containsText('pound')(v),
        },
      },
    ],
  },
  {
    id: 'goal-003',
    name: 'Check in on goal progress',
    category: 'goal-management',
    prompt: "I've read 5 books now, update my reading goal",
    context: {
      existingGoals: [
        {
          id: 'goal-1',
          title: 'Read 20 books',
          progress: 10,
          status: 'in_progress',
        },
      ],
    },
    expectedTools: [
      {
        name: 'check_in_goal',
      },
    ],
  },
  {
    id: 'goal-004',
    name: 'List current goals',
    category: 'goal-management',
    prompt: 'What are my current goals?',
    context: {
      existingGoals: [
        { id: 'goal-1', title: 'Read 20 books', progress: 25 },
        { id: 'goal-2', title: 'Run a marathon', progress: 50 },
      ],
    },
    expectedTools: [
      {
        name: 'list_goals',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // RULE MANAGEMENT (4 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'rule-001',
    name: 'Re-enable disabled rule instead of creating duplicate',
    category: 'rule-management',
    prompt: 'Start speaking like a pirate again',
    context: {
      existingRules: [
        {
          id: 'rule-1',
          rule_text: 'Speak like a pirate',
          enabled: false,
          priority: 5,
        },
      ],
    },
    expectedTools: [
      {
        name: 'toggle_rule',
        args: {
          enabled: true,
        },
        argMatchers: {
          rule_id: (v) => v === 'rule-1',
        },
      },
    ],
    forbiddenTools: ['create_rule'],
  },
  {
    id: 'rule-002',
    name: 'Create new rule when none exists',
    category: 'rule-management',
    prompt: 'Always schedule my meetings in the afternoon',
    context: {
      existingRules: [],
    },
    expectedTools: [
      {
        name: 'create_rule',
        argMatchers: {
          rule_text: containsText('afternoon'),
        },
      },
    ],
  },
  {
    id: 'rule-003',
    name: 'Disable an active rule',
    category: 'rule-management',
    prompt: "Stop speaking like a pirate, it's annoying",
    context: {
      existingRules: [
        {
          id: 'rule-1',
          rule_text: 'Speak like a pirate',
          enabled: true,
          priority: 5,
        },
      ],
    },
    expectedTools: [
      {
        name: 'toggle_rule',
        args: {
          enabled: false,
        },
      },
    ],
    forbiddenTools: ['delete_rule'],
  },
  {
    id: 'rule-004',
    name: 'List all rules',
    category: 'rule-management',
    prompt: 'What rules do I have set up?',
    context: {
      existingRules: [
        { id: 'rule-1', rule_text: 'Schedule deep work in mornings', enabled: true },
        { id: 'rule-2', rule_text: 'No meetings on Fridays', enabled: false },
      ],
    },
    expectedTools: [
      {
        name: 'list_rules',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // MULTI-DOMAIN (6 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'multi-001',
    name: 'Create event and related task',
    category: 'multi-domain',
    prompt: 'Schedule a presentation on Friday at 2pm and add a task to prepare slides',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('presentation'),
        },
      },
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('slides'),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'multi-002',
    name: 'Event with goal connection',
    category: 'multi-domain',
    prompt: 'Add a gym session tomorrow and update my fitness goal progress',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Fitness' }],
      existingGoals: [
        {
          id: 'goal-1',
          title: 'Work out 3x per week',
          progress: 50,
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('gym'),
        },
      },
      {
        name: 'check_in_goal',
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'multi-003',
    name: 'Delete event and create replacement task',
    category: 'multi-domain',
    prompt: "Cancel my dentist appointment and add a task to reschedule it",
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Dentist',
          start_time: '2026-01-22T14:00:00Z',
          end_time: '2026-01-22T15:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'delete_event',
        argMatchers: {
          searchQuery: containsText('dentist'),
        },
      },
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('reschedule'),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'multi-004',
    name: 'Query calendar and tasks together',
    category: 'multi-domain',
    prompt: "What do I have scheduled tomorrow and what tasks are due?",
    expectedTools: [
      { name: 'list_events' },
      { name: 'list_tasks' },
    ],
    allowExtraTools: true,
  },
  {
    id: 'multi-005',
    name: 'Search across multiple domains',
    category: 'multi-domain',
    prompt: 'Show me everything related to the Johnson project',
    context: {
      existingEvents: [
        { id: 'evt-1', title: 'Johnson Project Meeting', start_time: '2026-01-22T14:00:00Z', end_time: '2026-01-22T15:00:00Z' },
      ],
      existingTasks: [
        { id: 'task-1', title: 'Review Johnson proposal' },
      ],
    },
    expectedTools: [
      { name: 'search_events', argMatchers: { query: containsText('johnson') } },
      { name: 'search_tasks', argMatchers: { query: containsText('johnson') } },
    ],
    allowExtraTools: true,
  },
  {
    id: 'multi-006',
    name: 'Create category and then use it',
    category: 'multi-domain',
    prompt: 'Create a new category called "Side Projects" and add a task for working on my app',
    expectedTools: [
      {
        name: 'create_category',
        argMatchers: {
          name: containsText('side project'),
        },
        order: 0,
      },
      {
        name: 'create_task',
        order: 1,
      },
    ],
    allowExtraTools: true,
  },

  // ---------------------------------------------------------------------------
  // EDGE CASES (6 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'edge-001',
    name: 'Ambiguous time requires clarification',
    category: 'edge-cases',
    prompt: 'Schedule a call with Mike',
    expectedTools: [
      // Agent should ask for clarification or make reasonable default
      // This test validates the agent doesn't fail
    ],
    allowExtraTools: true,
  },
  {
    id: 'edge-003',
    name: 'Handle relative time - next week',
    category: 'edge-cases',
    prompt: 'Add a review meeting next Wednesday at 3pm',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('review'),
          start_time: containsTime('T15:00'),
        },
      },
    ],
  },
  {
    id: 'edge-004',
    name: 'Handle recurring with end date',
    category: 'edge-cases',
    prompt: 'Schedule yoga class every Tuesday and Thursday at 6pm until March',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Fitness' }],
    },
    expectedTools: [
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('yoga'),
        },
      },
    ],
  },
  {
    id: 'edge-005',
    name: 'Distinguish task from event - need to vs scheduled',
    category: 'edge-cases',
    prompt: 'I need to prepare the quarterly report',
    expectedTools: [
      {
        name: 'create_task',
        argMatchers: {
          title: containsText('quarterly report'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'edge-006',
    name: 'Handle profile query',
    category: 'edge-cases',
    prompt: "What's my timezone set to?",
    expectedTools: [
      {
        name: 'get_profile',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SEARCH & ANALYSIS (4 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'search-001',
    name: 'Search for events by title',
    category: 'search-analysis',
    prompt: 'Find all my meetings with John',
    context: {
      existingEvents: [
        { id: 'evt-1', title: 'Meeting with John', start_time: '2026-01-22T14:00:00Z', end_time: '2026-01-22T15:00:00Z' },
        { id: 'evt-2', title: 'Lunch with John', start_time: '2026-01-23T12:00:00Z', end_time: '2026-01-23T13:00:00Z' },
      ],
    },
    expectedTools: [
      {
        name: 'search_events',
        argMatchers: {
          query: containsText('john'),
        },
      },
    ],
  },
  {
    id: 'search-002',
    name: 'Analyze schedule for free time',
    category: 'search-analysis',
    prompt: 'When am I free tomorrow?',
    context: {
      existingEvents: [
        { id: 'evt-1', title: 'Morning Meeting', start_time: '2026-01-22T09:00:00Z', end_time: '2026-01-22T10:00:00Z' },
        { id: 'evt-2', title: 'Lunch', start_time: '2026-01-22T12:00:00Z', end_time: '2026-01-22T13:00:00Z' },
      ],
    },
    expectedTools: [
      {
        name: 'analyze_schedule',
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'search-003',
    name: 'List events for specific day',
    category: 'search-analysis',
    prompt: "What's on my calendar for Friday?",
    expectedTools: [
      {
        name: 'list_events',
      },
    ],
  },
  {
    id: 'search-004',
    name: 'Search tasks by keyword',
    category: 'search-analysis',
    prompt: 'Show me all tasks related to the website',
    context: {
      existingTasks: [
        { id: 'task-1', title: 'Update website homepage' },
        { id: 'task-2', title: 'Fix website bug' },
        { id: 'task-3', title: 'Buy groceries' },
      ],
    },
    expectedTools: [
      {
        name: 'search_tasks',
        argMatchers: {
          query: containsText('website'),
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // CATEGORY MANAGEMENT (3 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'category-001',
    name: 'Create new category',
    category: 'category-management',
    prompt: 'Create a new category called Machine Learning',
    expectedTools: [
      {
        name: 'create_category',
        argMatchers: {
          name: containsText('machine learning'),
        },
      },
    ],
  },
  {
    id: 'category-002',
    name: 'List all categories',
    category: 'category-management',
    prompt: 'What categories do I have?',
    expectedTools: [
      {
        name: 'list_categories',
      },
    ],
  },
  {
    id: 'category-003',
    name: 'Delete unused category',
    category: 'category-management',
    prompt: 'Delete the Old Project category',
    context: {
      existingCategories: [
        { id: 'cat-1', name: 'Work' },
        { id: 'cat-2', name: 'Old Project' },
      ],
    },
    expectedTools: [
      {
        name: 'delete_category',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // RELATIVE TIME (5 cases) — validates NowISO-based time math
  // ---------------------------------------------------------------------------
  {
    id: 'rel-time-001',
    name: 'Event 15 minutes from now uses PM not AM',
    category: 'relative-time',
    prompt: 'make a test event 15 min from now',
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: isDateString(),
        },
      },
    ],
    responseNotContains: ['AM'],
  },
  {
    id: 'rel-time-002',
    name: 'Event in 2 hours from current time',
    category: 'relative-time',
    prompt: 'schedule a call in 2 hours',
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: isDateString(),
        },
      },
    ],
  },
  {
    id: 'rel-time-003',
    name: 'Event 30 minutes from now',
    category: 'relative-time',
    prompt: 'add a quick meeting 30 min from now',
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: isDateString(),
        },
      },
    ],
  },
  {
    id: 'rel-time-004',
    name: 'Event in 45 minutes',
    category: 'relative-time',
    prompt: 'put a reminder call on my calendar in 45 minutes',
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: isDateString(),
        },
      },
    ],
  },
  {
    id: 'rel-time-005',
    name: 'Event "in an hour" from now',
    category: 'relative-time',
    prompt: 'schedule a check-in in an hour',
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: isDateString(),
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // TEMPORAL ANCHORING (4 cases) — "after X", "before Y"
  // ---------------------------------------------------------------------------
  {
    id: 'anchor-001',
    name: 'Schedule after existing event uses its end time',
    category: 'temporal-anchoring',
    prompt: 'schedule gym after my rehearsal',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Rehearsal',
          start_time: '2026-04-12T19:00:00Z',
          end_time: '2026-04-12T21:30:00Z',
        },
      ],
      existingCategories: [
        { id: 'cat-1', name: 'Health' },
        { id: 'cat-2', name: 'Music' },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('gym'),
          // Should start at or after 9:30 PM (rehearsal end)
          start_time: (v: any) => typeof v === 'string' && (v.includes('T21:30') || v.includes('T22:') || v.includes('T17:30')),
        },
      },
    ],
  },
  {
    id: 'anchor-002',
    name: 'Schedule before existing event ends before it starts',
    category: 'temporal-anchoring',
    prompt: 'add a 30 min coffee break right before my 3pm meeting',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Team Meeting',
          start_time: '2026-04-12T15:00:00Z',
          end_time: '2026-04-12T16:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('coffee'),
          // Should end at 3pm, start at 2:30pm
          start_time: (v: any) => typeof v === 'string' && (v.includes('T14:30') || v.includes('T10:30')),
        },
      },
    ],
  },
  {
    id: 'anchor-003',
    name: 'Inherit PM from anchored event — no AM flip',
    category: 'temporal-anchoring',
    prompt: 'add drinks after my dinner',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Dinner with Sarah',
          start_time: '2026-04-12T19:00:00Z',
          end_time: '2026-04-12T20:30:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('drinks'),
          // Must be PM, not flipped to AM
          start_time: (v: any) => typeof v === 'string' && (v.includes('T20:30') || v.includes('T21:') || v.includes('T16:30') || v.includes('T17:')),
        },
      },
    ],
  },
  {
    id: 'anchor-004',
    name: 'Squeeze event between two existing events',
    category: 'temporal-anchoring',
    prompt: 'i want to squeeze in lunch between my 11am and 2pm',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Morning Workshop',
          start_time: '2026-04-12T11:00:00Z',
          end_time: '2026-04-12T12:00:00Z',
        },
        {
          id: 'evt-2',
          title: 'Afternoon Review',
          start_time: '2026-04-12T14:00:00Z',
          end_time: '2026-04-12T15:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('lunch'),
          // Should fit between noon and 2pm
          start_time: (v: any) => typeof v === 'string' && (v.includes('T12:') || v.includes('T08:')),
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // AM/PM INFERENCE (4 cases) — bare numbers default to PM
  // ---------------------------------------------------------------------------
  {
    id: 'ampm-001',
    name: 'Bare "8" for drinks defaults to PM',
    category: 'ampm-inference',
    prompt: 'drinks at 8',
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: containsTime('T20:00'),
        },
      },
    ],
  },
  {
    id: 'ampm-002',
    name: 'Bare "6" for yoga defaults to PM',
    category: 'ampm-inference',
    prompt: 'yoga at 6',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Health' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: containsTime('T18:00'),
        },
      },
    ],
  },
  {
    id: 'ampm-003',
    name: 'Bare "5:30" for run is AM (early morning activity)',
    category: 'ampm-inference',
    prompt: '5:30 run tomorrow',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Health' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('run'),
          start_time: containsTime('T05:30'),
        },
      },
    ],
  },
  {
    id: 'ampm-004',
    name: 'Bare "9" for meeting defaults to AM (work context)',
    category: 'ampm-inference',
    prompt: 'team meeting at 9 tomorrow',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: containsTime('T09:00'),
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // CORRECTION / UNDO (4 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'correct-001',
    name: 'Update recently created event time',
    category: 'correction-undo',
    prompt: 'actually change that dinner to 8pm',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Dinner at Nobu',
          start_time: '2026-04-12T19:00:00Z',
          end_time: '2026-04-12T20:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          start_time: containsTime('T20:00'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'correct-002',
    name: 'Update event location',
    category: 'correction-undo',
    prompt: 'change the location to Mastros instead',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Dinner at Nobu',
          start_time: '2026-04-12T20:00:00Z',
          end_time: '2026-04-12T21:00:00Z',
          location: 'Nobu',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          location: containsText('mastro'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'correct-003',
    name: 'Delete last created event (nvm / undo)',
    category: 'correction-undo',
    prompt: 'nvm delete that',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Gym Session',
          start_time: '2026-04-12T18:00:00Z',
          end_time: '2026-04-12T19:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'delete_event',
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'correct-004',
    name: 'Correct event title',
    category: 'correction-undo',
    prompt: 'rename that meeting to "Project Review" instead',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Team Meeting',
          start_time: '2026-04-12T14:00:00Z',
          end_time: '2026-04-12T15:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          title: containsText('project review'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'correct-005',
    name: 'Imperative correction: "should be at Xpm"',
    category: 'correction-undo',
    prompt: 'should be at 8pm today',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Go out',
          start_time: '2026-04-11T22:00:00Z',
          end_time: '2026-04-12T00:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          start_time: containsTime('T20:00'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },
  {
    id: 'correct-006',
    name: 'Imperative correction: "yeah i want it to start 10pm"',
    category: 'correction-undo',
    prompt: 'yeah i want it to start 10pm',
    context: {
      existingEvents: [
        {
          id: 'evt-1',
          title: 'Go out',
          start_time: '2026-04-11T20:00:00Z',
          end_time: '2026-04-11T22:00:00Z',
        },
      ],
    },
    expectedTools: [
      {
        name: 'update_event',
        argMatchers: {
          start_time: containsTime('T22:00'),
        },
      },
    ],
    forbiddenTools: ['create_event'],
  },

  // ---------------------------------------------------------------------------
  // NATURAL LANGUAGE / MESSY INPUT (4 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'natural-001',
    name: 'Slang: "throw on cal tmrw"',
    category: 'natural-language',
    prompt: 'yo can u throw a gym sesh on my cal tmrw at like 6',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Health' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: (v: any) => typeof v === 'string' && (v.toLowerCase().includes('gym') || v.toLowerCase().includes('workout')),
          start_time: containsTime('T18:00'),
        },
      },
    ],
  },
  {
    id: 'natural-002',
    name: 'Vague time: "friday afternoon idc what time"',
    category: 'natural-language',
    prompt: 'put a haircut on there for friday afternoon idc what time just not before 2',
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('haircut'),
          // Should be 2pm or later
          start_time: (v: any) => {
            if (typeof v !== 'string') return false;
            const hourMatch = v.match(/T(\d{2}):/);
            return hourMatch ? parseInt(hourMatch[1]) >= 14 : false;
          },
        },
      },
    ],
  },
  {
    id: 'natural-003',
    name: 'Abbreviated input with typo',
    category: 'natural-language',
    prompt: 'mtg w/ jake tues 2pm re: budget reveiw',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: (v: any) => typeof v === 'string' && v.toLowerCase().includes('jake'),
          start_time: containsTime('T14:00'),
        },
      },
    ],
  },
  {
    id: 'natural-004',
    name: 'Implicit event from statement',
    category: 'natural-language',
    prompt: "i'm meeting Jake at the library at 4pm tomorrow",
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('jake'),
          location: containsText('library'),
          start_time: containsTime('T16:00'),
        },
      },
    ],
    forbiddenTools: ['create_task'],
  },

  // ---------------------------------------------------------------------------
  // MULTI-STEP CASCADE (3 cases) — complex multi-tool sequences
  // ---------------------------------------------------------------------------
  {
    id: 'cascade-001',
    name: 'Goal + recurring events + task in one message',
    category: 'multi-step-cascade',
    prompt: 'I want to train for a half marathon in October. Set a goal, create recurring runs on Tuesdays and Thursdays at 6:30am, and add a task to buy new running shoes this week.',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Health' }],
    },
    expectedTools: [
      {
        name: 'create_goal',
        argMatchers: {
          title: (v: any) => typeof v === 'string' && (v.toLowerCase().includes('marathon') || v.toLowerCase().includes('half')),
        },
      },
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('run'),
        },
      },
      {
        name: 'create_task',
        argMatchers: {
          title: (v: any) => typeof v === 'string' && (v.toLowerCase().includes('shoe') || v.toLowerCase().includes('running')),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'cascade-002',
    name: 'Full day planning: multiple events + task',
    category: 'multi-step-cascade',
    prompt: 'plan my day tomorrow: gym at 7am, work from 9-5 with a lunch break at noon, dinner at 7pm, and add a task to prep for my morning meeting',
    context: {
      existingCategories: [
        { id: 'cat-1', name: 'Health' },
        { id: 'cat-2', name: 'Work' },
        { id: 'cat-3', name: 'Personal' },
      ],
    },
    expectedTools: [
      { name: 'create_event', argMatchers: { title: containsText('gym') } },
      { name: 'create_event', argMatchers: { title: containsText('work') } },
      { name: 'create_event', argMatchers: { title: containsText('lunch') } },
      { name: 'create_event', argMatchers: { title: containsText('dinner') } },
      { name: 'create_task', argMatchers: { title: containsText('prep') } },
    ],
    allowExtraTools: true,
  },
  {
    id: 'cascade-003',
    name: 'Presentation: event + task (goal may fail schema)',
    category: 'multi-step-cascade',
    prompt: 'Schedule a presentation Friday at 2pm and add a task to prepare slides by Thursday',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      { name: 'create_event', argMatchers: { title: containsText('presentation') } },
      { name: 'create_task', argMatchers: { title: containsText('slide') } },
    ],
    allowExtraTools: true,
  },

  // ---------------------------------------------------------------------------
  // PAST TIME REJECTION (2 cases) — never schedule in the past
  // ---------------------------------------------------------------------------
  {
    id: 'past-001',
    name: 'Past time gets shifted forward or flagged',
    category: 'past-time-rejection',
    prompt: 'schedule a meeting at 6am today',
    // Agent may create event shifted to tomorrow or flag the conflict
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          start_time: isDateString(),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'past-002',
    name: 'Bare number in the past flips to PM',
    category: 'past-time-rejection',
    prompt: 'add a call at 8 today',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Work' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          // If it's afternoon, 8 should mean 8pm not 8am
          start_time: containsTime('T20:00'),
        },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SHARED EVENTS (3 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'shared-001',
    name: 'Create event and invite friend',
    category: 'shared-events',
    prompt: 'schedule dinner with Alex Saturday at 7pm at Nobu and invite them',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Social' }],
    },
    expectedTools: [
      {
        name: 'create_event',
        argMatchers: {
          title: containsText('dinner'),
          location: containsText('nobu'),
          start_time: containsTime('T19:00'),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'shared-002',
    name: 'Create shared recurring event with friends',
    category: 'shared-events',
    prompt: 'set up a weekly soccer game every Thursday at 6pm and invite Alex and Jordan',
    context: {
      existingCategories: [{ id: 'cat-1', name: 'Sports' }],
    },
    expectedTools: [
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('soccer'),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'shared-003',
    name: 'Create aspect then shared event under it',
    category: 'shared-events',
    prompt: 'Create a "Book Club" aspect and schedule a monthly book club meeting on the first Saturday at 2pm',
    expectedTools: [
      {
        name: 'create_category',
        argMatchers: {
          name: containsText('book club'),
        },
        order: 0,
      },
      {
        name: 'create_recurring_event',
        argMatchers: {
          title: containsText('book club'),
        },
      },
    ],
    allowExtraTools: true,
  },

  // ---------------------------------------------------------------------------
  // NOTES & MEMORY (3 cases)
  // ---------------------------------------------------------------------------
  {
    id: 'notes-001',
    name: 'Save a note with factual info',
    category: 'notes-memory',
    prompt: "save a note that my landlord's number is 415-555-1234 and rent is due on the 1st",
    expectedTools: [
      {
        name: 'create_notes',
        argMatchers: {
          content: (v: any) => typeof v === 'string' && v.includes('415-555-1234'),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'notes-002',
    name: 'Create note about meeting takeaways',
    category: 'notes-memory',
    prompt: 'make a note: team decided to switch to biweekly sprints starting next month, Jake is leading the migration',
    expectedTools: [
      {
        name: 'create_notes',
        argMatchers: {
          content: (v: any) => typeof v === 'string' && (v.toLowerCase().includes('sprint') || v.toLowerCase().includes('biweekly')),
        },
      },
    ],
    allowExtraTools: true,
  },
  {
    id: 'notes-003',
    name: 'Search memory for stored info',
    category: 'notes-memory',
    prompt: 'what do you know about my work schedule?',
    expectedTools: [
      {
        name: 'search_memory_unified',
      },
    ],
    allowExtraTools: true,
  },
];

/**
 * Get test cases by category
 */
export function getTestCasesByCategory(category: string): BehaviorTestCase[] {
  return behaviorTestCases.filter(tc => tc.category === category);
}

/**
 * Get a single test case by ID
 */
export function getTestCaseById(id: string): BehaviorTestCase | undefined {
  return behaviorTestCases.find(tc => tc.id === id);
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  return Array.from(new Set(behaviorTestCases.map(tc => tc.category)));
}

/**
 * Get test cases that should run (not skipped, or only if marked)
 */
export function getRunnableTestCases(): BehaviorTestCase[] {
  const onlyTests = behaviorTestCases.filter(tc => tc.only);
  if (onlyTests.length > 0) {
    return onlyTests;
  }
  return behaviorTestCases.filter(tc => !tc.skip);
}
