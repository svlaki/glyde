/**
 * Reusable Supabase mock helpers for agent tests.
 *
 * Usage (vi.hoisted pattern):
 *   const { mockSupabaseClient, mockSupabaseService, resetMocks } = await import('./helpers/mockSupabase.js');
 *   vi.mock('../../services/SupabaseService.js', () => ({ ... }));
 */

// ---------------------------------------------------------------------------
// Chainable query builder mock
// ---------------------------------------------------------------------------

function createChainable() {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    csv: vi.fn().mockResolvedValue({ data: '', error: null }),
    then: vi.fn(
      (resolve: (value: { data: any[]; error: null }) => void) =>
        resolve({ data: [], error: null })
    ),
  };

  return chainable;
}

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const chainable = createChainable();

export const mockSupabaseClient = {
  from: vi.fn().mockReturnValue(chainable),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  },
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  }),
  /**
   * Direct access to the chainable query object so tests can override
   * return values, e.g.:
   *   mockSupabaseClient.chainable.single.mockResolvedValueOnce({ data: myRow, error: null });
   */
  chainable,
};

// ---------------------------------------------------------------------------
// Mock SupabaseService (class-level method stubs)
// ---------------------------------------------------------------------------

export const mockSupabaseService = {
  // Client access
  getClient: vi.fn().mockReturnValue(mockSupabaseClient),

  // Profile
  getProfile: vi.fn().mockResolvedValue(null),

  // Aspects
  getAspects: vi.fn().mockResolvedValue([]),

  // Events
  getEvents: vi.fn().mockResolvedValue([]),
  getEventsForAgent: vi.fn().mockResolvedValue([]),
  getRawEvents: vi.fn().mockResolvedValue([]),
  createEvent: vi.fn().mockResolvedValue(null),
  updateEvent: vi.fn().mockResolvedValue({ success: true, event: null }),
  deleteEvent: vi.fn().mockResolvedValue({ success: true }),
  getExpandedEvents: vi.fn().mockResolvedValue([]),
  getFriendsEvents: vi.fn().mockResolvedValue([]),
  createRecurringEvent: vi.fn().mockResolvedValue(null),
  updateRecurringEventInstance: vi.fn().mockResolvedValue({ success: true }),
  deleteRecurringEventInstance: vi.fn().mockResolvedValue(true),
  updateRecurringEventSeries: vi.fn().mockResolvedValue({ success: true }),
  deleteRecurringEventSeries: vi.fn().mockResolvedValue(true),

  // Tasks
  getTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue(null),
  updateTask: vi.fn().mockResolvedValue({ success: true }),
  deleteTask: vi.fn().mockResolvedValue({ success: true }),
  completeTask: vi.fn().mockResolvedValue({ success: true }),

  // Goals
  getGoals: vi.fn().mockResolvedValue([]),
  createGoal: vi.fn().mockResolvedValue(null),
  updateGoal: vi.fn().mockResolvedValue({ success: true }),
  deleteGoal: vi.fn().mockResolvedValue({ success: true }),
  addGoalCheckIn: vi.fn().mockResolvedValue(null),
  getGoalCheckIns: vi.fn().mockResolvedValue([]),

  // Chat
  getChatMessages: vi.fn().mockResolvedValue([]),
  addChatMessage: vi.fn().mockResolvedValue(null),

  // Interactions
  createUserInteraction: vi.fn().mockResolvedValue(null),
  getPendingUserInteractions: vi.fn().mockResolvedValue([]),
  getRecentUserInteractions: vi.fn().mockResolvedValue([]),
  getUserInteractionById: vi.fn().mockResolvedValue(null),
  saveInteractionResponse: vi.fn().mockResolvedValue({ success: true }),
  cancelPendingInteractions: vi.fn().mockResolvedValue(0),
  updateInteractionStatus: vi.fn().mockResolvedValue(true),

  // Ratings
  createRating: vi.fn().mockResolvedValue(null),
  getRatings: vi.fn().mockResolvedValue([]),
  getRatingSummary: vi.fn().mockResolvedValue([]),

  // Reminders (via ReminderService, but included for convenience)
  getReminders: vi.fn().mockResolvedValue([]),
  createReminder: vi.fn().mockResolvedValue(null),

  // Settings
  getUserSettings: vi.fn().mockResolvedValue({}),
  updateUserSetting: vi.fn().mockResolvedValue(true),

  // Activity
  logActivity: vi.fn().mockResolvedValue(undefined),
  getRecentActivity: vi.fn().mockResolvedValue([]),

  // Notes
  getNotes: vi.fn().mockResolvedValue(null),
  createNotes: vi.fn().mockResolvedValue(null),
  updateNotes: vi.fn().mockResolvedValue({ success: true }),
  deleteNotes: vi.fn().mockResolvedValue({ success: true, error: null }),

  // Vector search
  searchSimilarEvents: vi.fn().mockResolvedValue([]),
  searchSimilarChats: vi.fn().mockResolvedValue([]),

  // Subscriptions
  subscribeToUserChanges: vi.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Reset helper
// ---------------------------------------------------------------------------

export function resetMocks(): void {
  // Reset chainable methods
  for (const key of Object.keys(chainable)) {
    const fn = chainable[key];
    if (typeof fn?.mockClear === 'function') {
      fn.mockClear();
    }
  }

  // Restore default return values on terminal chainable methods
  chainable.select.mockReturnThis();
  chainable.insert.mockReturnThis();
  chainable.update.mockReturnThis();
  chainable.delete.mockReturnThis();
  chainable.upsert.mockReturnThis();
  chainable.eq.mockReturnThis();
  chainable.neq.mockReturnThis();
  chainable.gt.mockReturnThis();
  chainable.gte.mockReturnThis();
  chainable.lt.mockReturnThis();
  chainable.lte.mockReturnThis();
  chainable.like.mockReturnThis();
  chainable.ilike.mockReturnThis();
  chainable.in.mockReturnThis();
  chainable.is.mockReturnThis();
  chainable.not.mockReturnThis();
  chainable.or.mockReturnThis();
  chainable.filter.mockReturnThis();
  chainable.match.mockReturnThis();
  chainable.order.mockReturnThis();
  chainable.limit.mockReturnThis();
  chainable.range.mockReturnThis();
  chainable.single.mockResolvedValue({ data: null, error: null });
  chainable.maybeSingle.mockResolvedValue({ data: null, error: null });
  chainable.csv.mockResolvedValue({ data: '', error: null });
  chainable.then.mockImplementation(
    (resolve: (value: { data: any[]; error: null }) => void) =>
      resolve({ data: [], error: null })
  );

  // Reset client-level mocks
  mockSupabaseClient.from.mockClear();
  mockSupabaseClient.from.mockReturnValue(chainable);
  mockSupabaseClient.rpc.mockClear();
  mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });

  // Reset service mocks
  for (const key of Object.keys(mockSupabaseService)) {
    const fn = (mockSupabaseService as Record<string, any>)[key];
    if (typeof fn?.mockClear === 'function') {
      fn.mockClear();
    }
  }

  // Restore common service defaults
  mockSupabaseService.getClient.mockReturnValue(mockSupabaseClient);
  mockSupabaseService.getEvents.mockResolvedValue([]);
  mockSupabaseService.getTasks.mockResolvedValue([]);
  mockSupabaseService.getGoals.mockResolvedValue([]);
  mockSupabaseService.getAspects.mockResolvedValue([]);
  mockSupabaseService.getReminders.mockResolvedValue([]);
  mockSupabaseService.getProfile.mockResolvedValue(null);
}
