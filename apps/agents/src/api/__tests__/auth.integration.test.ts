import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authenticateRequest } from '../middleware/auth.js';
import { getUserEvents } from '../events.js';
import { createUserTask } from '../tasks.js';

const { getUserMock, mockSupabaseService } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const mockSupabaseService = {
    getEvents: vi.fn(),
    createEvent: vi.fn(),
    getTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    completeTask: vi.fn()
  };

  return { getUserMock, mockSupabaseService };
});

const TEST_SECRET = 'test-secret';

vi.mock('../../services/SupabaseService.js', () => ({
  initializeSupabase: vi.fn(),
  SupabaseService: vi.fn(() => mockSupabaseService),
  getSupabaseService: () => mockSupabaseService,
  getSupabaseClient: () => ({ auth: { getUser: getUserMock } }),
  supabase: { auth: { getUser: getUserMock } }
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticateRequest);
  app.post('/api/events', getUserEvents);
  app.post('/api/tasks/create', createUserTask);
  return app;
}

beforeEach(() => {
  process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  process.env.SKIP_SUPABASE_AUTH = 'true';

  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: null, error: new Error('skipped') });

  mockSupabaseService.getEvents.mockReset();
  mockSupabaseService.getEvents.mockResolvedValue([]);

  mockSupabaseService.createTask.mockReset();
  mockSupabaseService.createTask.mockResolvedValue({ id: 'task-1' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('authentication middleware', () => {
  it('rejects requests without an authorization header', async () => {
    const app = createTestApp();
    const response = await request(app).post('/api/events').send({});

    expect(response.status).toBe(401);
    expect(mockSupabaseService.getEvents).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid token', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/api/events')
      .set('Authorization', 'Bearer invalid-token')
      .send({});

    expect(response.status).toBe(401);
    expect(mockSupabaseService.getEvents).not.toHaveBeenCalled();
  });

  it('uses the authenticated user id instead of the payload user_id when reading data', async () => {
    const app = createTestApp();
    const authedUserId = 'auth-user';
    const token = jwt.sign({ sub: authedUserId }, TEST_SECRET);

    mockSupabaseService.getEvents.mockResolvedValue([{ id: 'event-1', user_id: authedUserId }]);

    const response = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: 'other-user', start_date: '2024-01-01', end_date: '2024-01-31' });

    expect(response.status).toBe(200);
    expect(mockSupabaseService.getEvents).toHaveBeenCalledWith(authedUserId, '2024-01-01', '2024-01-31');
  });

  it('uses the authenticated user id for write operations', async () => {
    const app = createTestApp();
    const authedUserId = 'auth-user';
    const token = jwt.sign({ sub: authedUserId }, TEST_SECRET);

    const response = await request(app)
      .post('/api/tasks/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: 'other-user', title: 'Task Title', description: 'Details' });

    expect(response.status).toBe(200);
    expect(mockSupabaseService.createTask).toHaveBeenCalledWith(
      authedUserId,
      expect.objectContaining({ title: 'Task Title', description: 'Details' })
    );
  });
});
