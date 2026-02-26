/**
 * Shared test fixtures for agent tests.
 */

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

export const TEST_USER_ID = 'test-user-123';
export const TEST_ASPECT_ID = 'aspect-456';
export const TEST_EVENT_ID = 'event-789';
export const TEST_REMINDER_ID = 'reminder-012';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const testAspect = {
  id: TEST_ASPECT_ID,
  user_id: TEST_USER_ID,
  name: 'Work',
  color: '#3b82f6',
  icon: 'briefcase',
} as const;

export const testEvent = {
  id: TEST_EVENT_ID,
  user_id: TEST_USER_ID,
  title: 'Team Meeting',
  start_time: '2026-02-26T14:00:00Z',
  end_time: '2026-02-26T15:00:00Z',
  aspect_id: TEST_ASPECT_ID,
} as const;

export const testReminder = {
  id: TEST_REMINDER_ID,
  user_id: TEST_USER_ID,
  message: 'Team Meeting in 15 minutes',
  trigger_at: '2026-02-26T13:45:00Z',
  status: 'pending',
  created_by: 'user',
  metadata: {},
  created_at: '2026-02-26T10:00:00Z',
  updated_at: '2026-02-26T10:00:00Z',
} as const;

export const testTask = {
  id: 'task-345',
  user_id: TEST_USER_ID,
  title: 'Review PR',
  status: 'pending',
  priority: 'high',
  aspect_id: TEST_ASPECT_ID,
  created_at: '2026-02-26T10:00:00Z',
  updated_at: '2026-02-26T10:00:00Z',
} as const;
