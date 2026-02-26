import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authenticateRequest } from '../middleware/auth.js';
import {
  getUserReminders,
  createUserReminder,
  deleteUserReminder,
  snoozeUserReminder,
  dismissEventReminders,
} from '../reminders.js';

const { mockReminderService } = vi.hoisted(() => {
  const mockReminderService = {
    getReminders: vi.fn(),
    createReminder: vi.fn(),
    updateReminder: vi.fn(),
    deleteReminder: vi.fn(),
    snoozeReminder: vi.fn(),
    dismissEventReminders: vi.fn(),
    getReminderById: vi.fn(),
    getDueReminders: vi.fn(),
    markDelivered: vi.fn(),
    syncEventReminder: vi.fn(),
  };
  return { mockReminderService };
});

vi.mock('../../services/ReminderService.js', () => ({
  ReminderService: vi.fn(() => mockReminderService),
  default: mockReminderService,
}));

vi.mock('../../services/SupabaseService.js', () => ({
  initializeSupabase: vi.fn(),
  SupabaseService: vi.fn(),
  getSupabaseService: vi.fn(),
  getSupabaseClient: () => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: null, error: new Error('skipped') }) } }),
  supabase: { auth: { getUser: vi.fn() } },
}));

const TEST_SECRET = 'test-secret';
const TEST_USER_ID = 'auth-user-123';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticateRequest);
  app.post('/api/reminders', getUserReminders);
  app.post('/api/reminders/create', createUserReminder);
  app.post('/api/reminders/delete', deleteUserReminder);
  app.post('/api/reminders/snooze', snoozeUserReminder);
  app.post('/api/reminders/dismiss-event', dismissEventReminders);
  return app;
}

function authHeader() {
  const token = jwt.sign({ sub: TEST_USER_ID }, TEST_SECRET);
  return `Bearer ${token}`;
}

beforeEach(() => {
  process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  process.env.SKIP_SUPABASE_AUTH = 'true';

  Object.values(mockReminderService).forEach(fn => fn.mockReset());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/reminders', () => {
  it('returns 401 without auth header', async () => {
    const app = createTestApp();
    const res = await request(app).post('/api/reminders').send({});
    expect(res.status).toBe(401);
  });

  it('returns reminders for authenticated user', async () => {
    const app = createTestApp();
    const testReminders = [
      { id: 'r-1', message: 'Test', trigger_at: '2026-02-26T14:00:00Z', status: 'pending' },
    ];
    mockReminderService.getReminders.mockResolvedValue(testReminders);

    const res = await request(app)
      .post('/api/reminders')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reminders).toEqual(testReminders);
    expect(mockReminderService.getReminders).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ includeHistory: false })
    );
  });

  it('passes filters to the service', async () => {
    const app = createTestApp();
    mockReminderService.getReminders.mockResolvedValue([]);

    await request(app)
      .post('/api/reminders')
      .set('Authorization', authHeader())
      .send({ status: 'snoozed', include_history: true });

    expect(mockReminderService.getReminders).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ status: 'snoozed', includeHistory: true })
    );
  });
});

describe('POST /api/reminders/create', () => {
  it('returns 400 if message is missing', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/reminders/create')
      .set('Authorization', authHeader())
      .send({ trigger_at: '2026-02-27T09:00:00Z' });

    expect(res.status).toBe(400);
  });

  it('returns 400 if trigger_at is missing', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/reminders/create')
      .set('Authorization', authHeader())
      .send({ message: 'Remember this' });

    expect(res.status).toBe(400);
  });

  it('creates a reminder with valid data', async () => {
    const app = createTestApp();
    const newReminder = {
      id: 'r-new',
      message: 'Remember this',
      trigger_at: '2026-02-27T09:00:00Z',
      status: 'pending',
    };
    mockReminderService.createReminder.mockResolvedValue(newReminder);

    const res = await request(app)
      .post('/api/reminders/create')
      .set('Authorization', authHeader())
      .send({ message: 'Remember this', trigger_at: '2026-02-27T09:00:00Z' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reminder).toEqual(newReminder);
    expect(mockReminderService.createReminder).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({
        message: 'Remember this',
        trigger_at: '2026-02-27T09:00:00Z',
        created_by: 'user',
      })
    );
  });
});

describe('POST /api/reminders/delete', () => {
  it('returns 400 without reminder_id', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/reminders/delete')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
  });

  it('deletes a reminder', async () => {
    const app = createTestApp();
    mockReminderService.deleteReminder.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/api/reminders/delete')
      .set('Authorization', authHeader())
      .send({ reminder_id: 'r-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockReminderService.deleteReminder).toHaveBeenCalledWith(TEST_USER_ID, 'r-1');
  });

  it('returns 404 when reminder not found', async () => {
    const app = createTestApp();
    mockReminderService.deleteReminder.mockResolvedValue({ success: false, error: 'Not found' });

    const res = await request(app)
      .post('/api/reminders/delete')
      .set('Authorization', authHeader())
      .send({ reminder_id: 'nonexistent' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/reminders/snooze', () => {
  it('returns 400 without reminder_id', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/reminders/snooze')
      .set('Authorization', authHeader())
      .send({ snooze_minutes: 15 });

    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid snooze_minutes', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/reminders/snooze')
      .set('Authorization', authHeader())
      .send({ reminder_id: 'r-1', snooze_minutes: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 with negative snooze_minutes', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/reminders/snooze')
      .set('Authorization', authHeader())
      .send({ reminder_id: 'r-1', snooze_minutes: -5 });

    expect(res.status).toBe(400);
  });

  it('snoozes a reminder', async () => {
    const app = createTestApp();
    mockReminderService.snoozeReminder.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/reminders/snooze')
      .set('Authorization', authHeader())
      .send({ reminder_id: 'r-1', snooze_minutes: 15 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.snooze_until).toBeDefined();
    expect(mockReminderService.snoozeReminder).toHaveBeenCalledWith(
      TEST_USER_ID,
      'r-1',
      expect.any(String)
    );
  });
});

describe('POST /api/reminders/dismiss-event', () => {
  it('returns 400 without event_id', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/reminders/dismiss-event')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
  });

  it('dismisses all reminders for an event', async () => {
    const app = createTestApp();
    mockReminderService.dismissEventReminders.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/reminders/dismiss-event')
      .set('Authorization', authHeader())
      .send({ event_id: 'event-123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockReminderService.dismissEventReminders).toHaveBeenCalledWith(
      TEST_USER_ID,
      'event-123'
    );
  });
});
