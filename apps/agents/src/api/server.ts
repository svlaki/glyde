import { env, isDevelopment, ENV_PATH } from '../utils/env.js';
import { initializeSupabase, getSupabaseService } from '../services/SupabaseService.js';

// Set environment variables explicitly if needed
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these variables before starting the server.');
  process.exit(1);
}

// Validate environment variables format
if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
  console.error('SUPABASE_URL must be a valid HTTPS URL');
  process.exit(1);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length < 20) {
  console.error('SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)');
  process.exit(1);
}

initializeSupabase();

import express from 'express';
import cors from 'cors';
import { createUserSchema } from './user.js';
import { getUserEvents, createUserEvent, updateUserEvent, deleteUserEvent, createRecurringEvent, getExpandedEvents, updateRecurringEvent, deleteRecurringEvent, getFriendsEvents, toggleFriendEventVisibility } from './events.js';
import { getUserTasks, createUserTask, updateUserTask, deleteUserTask, completeUserTask } from './tasks.js';
import { getUserGoals, createUserGoal, updateUserGoal, deleteUserGoal, addGoalCheckIn, getGoalCheckIns } from './goals.js';
import { getUserNotes, createUserNotes, updateUserNotes, deleteUserNotes } from './notes.js';
import { getUserProfile, updateUserProfile, updateProfileField, batchUpdateProfileFields } from './profile.js';
import { getUserAspects, createUserAspect, updateUserAspect, deleteUserAspect, getAspectColor, archiveUserAspect, unarchiveUserAspect, getArchivedAspects } from './aspects.js';
import { getUserProjects, createUserProject, updateUserProject, deleteUserProject, archiveUserProject, unarchiveUserProject, getArchivedProjects as getArchivedUserProjects, getProjectDetail, tagEntityToProject } from './projects.js';
import { getPendingInteractions, respondToInteraction, clearUserInteractions } from './interactions.js';
import { getUserRatings, getRatingSummary, createRating } from './ratings.js';
import { getUserRules, createUserRule, updateUserRule, deleteUserRule, toggleUserRule } from './rules.js';
import {
  getConnections,
  getGoogleAuthUrl as getGoogleConnectionAuthUrl,
  handleGoogleCallback as handleGoogleConnectionCallback,
  getMicrosoftAuthUrl,
  handleMicrosoftCallback,
  triggerSync,
  getDisconnectPreview,
  disconnectConnection,
  handleGoogleWebhook,
  getCalendarList,
  getCalendarMappings,
  syncCalendarList,
  updateCalendarMapping
} from './connections.js';
import { getChatHistory, saveChatMessage, saveChatMessagesBatch, clearChatHistory } from './chat.js';
import { getUserReminders, createUserReminder, updateUserReminder, deleteUserReminder, snoozeUserReminder, dismissEventReminders } from './reminders.js';
import { processAgentMessage, addStartTime } from './agent.js';
import { streamAgentMessage } from './stream.js';
import friendshipRouter from './friendships.js';
import sharedAspectsRouter from './shared-aspects.js';
import sharedEventsRouter from './shared-events.js';
import { startWatchRenewalJob } from '../jobs/watch-renewal.js';
import { startReminderCheckerJob } from '../jobs/reminder-checker.js';
import { authenticateRequest } from './middleware/auth.js';
import { completeOnboarding, saveOnboardingStep } from './onboarding.js';
import analyticsRouter from './analytics.js';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  importGoogleCalendar,
  uploadCalendarFile,
  uploadMiddleware,
  getAnalysisStatus
} from './calendar.js';

const app = express();
const PORT = env.PORT;

// Middleware - Allow requests from Capacitor apps and web
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    // Allow localhost in any form (web dev, Capacitor simulator)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow Capacitor origins
    if (origin.startsWith('capacitor://')) {
      return callback(null, true);
    }

    // Allow ionic origins
    if (origin.startsWith('ionic://')) {
      return callback(null, true);
    }

    // Allow Railway production URLs
    if (origin.endsWith('.up.railway.app')) {
      return callback(null, true);
    }

    // Allow configured frontend URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    // In development, allow all
    if (isDevelopment) {
      return callback(null, true);
    }

    // Reject everything else in production
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware (simple in-memory store)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10);

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const clientData = rateLimitMap.get(clientIP);

  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    next();
  } else if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  } else {
    clientData.count++;
    next();
  }
});

// Request logging middleware
if (isDevelopment) {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[SERVER] ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
  });
}

// Performance tracking middleware — logs slow requests (>1s) and errors to beta_analytics_events
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  const originalEnd = res.end;
  let tracked = false;

  res.end = function (this: express.Response, ...args: any[]) {
    if (!tracked) {
      tracked = true;
      const duration = Date.now() - start;
      const status = res.statusCode;

      if (status >= 400 || duration > 1000) {
        try {
          const client = getSupabaseService().getClient();
          Promise.resolve(
            client.from('beta_analytics_events').insert({
              user_id: req.authUserId || null,
              event_name: status >= 400 ? 'api_error' : 'slow_request',
              event_category: 'performance',
              event_properties: {
                method: req.method,
                path: req.path,
                status,
                duration_ms: duration,
              },
              device_type: 'server',
            })
          ).catch(() => {});
        } catch {
          // Supabase not initialized yet (startup), skip
        }
      }
    }

    return originalEnd.apply(this, args as any);
  } as any;

  next();
});

// Authentication middleware - validates JWT and sets req.authUserId
// This runs early to ensure protected routes have user context
app.use(authenticateRequest);

// Input sanitization middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  // Skip sanitization for health check and agent endpoints (process and stream)
  if (req.url.includes('/health') || req.url.includes('/api/agent/')) {
    next();
    return;
  }

  // Sanitize string inputs to prevent XSS
  if (req.body && typeof req.body === 'object') {
    const sanitizeString = (str: any): string => {
      if (typeof str !== 'string') return str;
      return str
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .trim()
        .substring(0, 1000); // Limit length
    };

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    req.body = sanitizeObject(req.body);
  }

  next();
});

// Input validation middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  // Skip validation for health check and agent endpoints (process and stream)
  if (req.url.includes('/health') || req.url.includes('/api/agent/')) {
    next();
    return;
  }

  // Check for required user_id in POST requests (only if not already authenticated)
  // If authentication middleware set req.authUserId, we don't need user_id in body
  if (req.method === 'POST' && req.body && !req.body.user_id && !req.authUserId) {
    res.status(400).json({
      error: 'user_id is required in request body',
      success: false
    });
    return;
  }

  // Validate user_id format (UUID) if provided in body
  if (req.body && req.body.user_id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.body.user_id)) {
      res.status(400).json({
        error: 'Invalid user_id format',
        success: false
      });
      return;
    }
  }

  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { getSupabaseService } = await import('../services/SupabaseService.js');
    const supabaseService = getSupabaseService();
    
    // Simple database ping
    const { data, error } = await supabaseService.getClient()
      .from('profile')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Database health check failed:', error);
      res.status(503).json({ 
        status: 'error', 
        message: 'Database connection failed',
        timestamp: new Date().toISOString() 
      });
      return;
    }
    
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'error', 
      message: 'Service unavailable',
      timestamp: new Date().toISOString() 
    });
  }
});

// Note: Embedding and chat endpoints have been deprecated
// Use the agent endpoint for AI interactions

// User endpoints
app.post('/api/user/create-schema', createUserSchema);

// Events endpoints
app.post('/api/events', getUserEvents);
app.post('/api/events/expanded', getExpandedEvents);
app.post('/api/events/friends', getFriendsEvents);
app.post('/api/events/create', createUserEvent);
app.post('/api/events/create-recurring', createRecurringEvent);
app.post('/api/events/update', updateUserEvent);
app.post('/api/events/update-recurring', updateRecurringEvent);
app.post('/api/events/delete', deleteUserEvent);
app.post('/api/events/delete-recurring', deleteRecurringEvent);

// Tasks endpoints
app.post('/api/tasks', getUserTasks);
app.post('/api/tasks/create', createUserTask);
app.post('/api/tasks/update', updateUserTask);
app.post('/api/tasks/delete', deleteUserTask);
app.post('/api/tasks/complete', completeUserTask);

// Goals endpoints
app.post('/api/goals', getUserGoals);
app.post('/api/goals/create', createUserGoal);
app.post('/api/goals/update', updateUserGoal);
app.post('/api/goals/delete', deleteUserGoal);
app.post('/api/goals/check-in', addGoalCheckIn);
app.post('/api/goals/check-ins', getGoalCheckIns);

// Notes endpoints
app.post('/api/notes', getUserNotes);
app.post('/api/notes/create', createUserNotes);
app.post('/api/notes/update', updateUserNotes);
app.post('/api/notes/delete', deleteUserNotes);

// Profile endpoints
app.post('/api/profile', getUserProfile);
app.post('/api/profile/update', updateUserProfile);
app.post('/api/profile/field', updateProfileField);
app.post('/api/profile/batch-update', batchUpdateProfileFields);

// Aspects endpoints
app.post('/api/aspects', getUserAspects);
app.post('/api/aspects/create', createUserAspect);
app.post('/api/aspects/update', updateUserAspect);
app.post('/api/aspects/delete', deleteUserAspect);
app.post('/api/aspects/archive', archiveUserAspect);
app.post('/api/aspects/unarchive', unarchiveUserAspect);
app.post('/api/aspects/archived', getArchivedAspects);
app.post('/api/aspects/color', getAspectColor);

// Projects endpoints
app.post('/api/projects', getUserProjects);
app.post('/api/projects/create', createUserProject);
app.post('/api/projects/update', updateUserProject);
app.post('/api/projects/delete', deleteUserProject);
app.post('/api/projects/archive', archiveUserProject);
app.post('/api/projects/unarchive', unarchiveUserProject);
app.post('/api/projects/archived', getArchivedUserProjects);
app.post('/api/projects/detail', getProjectDetail);
app.post('/api/projects/tag', tagEntityToProject);

// Onboarding endpoints
app.post('/api/onboarding/complete', completeOnboarding);
app.post('/api/onboarding/save-step', saveOnboardingStep);

// Calendar integration endpoints (Google Calendar + ICS file upload only for beta)
app.post('/api/calendar/google/auth', getGoogleAuthUrl);
app.post('/api/calendar/google/callback', handleGoogleCallback);
app.post('/api/calendar/google/import', importGoogleCalendar);
app.post('/api/calendar/upload', uploadMiddleware, uploadCalendarFile);
app.get('/api/calendar/analysis/:jobId', getAnalysisStatus);

// Interaction endpoints
app.post('/api/interactions/pending', getPendingInteractions);
app.post('/api/interactions/respond', respondToInteraction);
app.post('/api/interactions/clear', clearUserInteractions);
// DISABLED: Automatic startup interaction generation removed
// Interactions are now created directly by the agent via create_interaction tool
// app.post('/api/interactions/generate-startup', generateStartupInteractions);

// Rating endpoints
app.post('/api/ratings', getUserRatings);
app.post('/api/ratings/summary', getRatingSummary);
app.post('/api/ratings/create', createRating);

// Rules endpoints
app.post('/api/rules', getUserRules);
app.post('/api/rules/create', createUserRule);
app.post('/api/rules/update', updateUserRule);
app.post('/api/rules/delete', deleteUserRule);
app.post('/api/rules/toggle', toggleUserRule);

// Friends endpoints
app.use('/api/friends', friendshipRouter);
app.post('/api/friends/:friendId/visibility', toggleFriendEventVisibility);

// Shared aspects endpoints
app.use('/api/shared-aspects', sharedAspectsRouter);

// Shared events endpoints
app.use('/api/shared-events', sharedEventsRouter);

// Admin analytics endpoints
app.use('/api/analytics', analyticsRouter);

// Connections endpoints (for calendar sync)
app.post('/api/connections', getConnections);
app.post('/api/connections/google/auth', getGoogleConnectionAuthUrl);
app.post('/api/connections/google/callback', handleGoogleConnectionCallback);
app.post('/api/connections/microsoft/auth', getMicrosoftAuthUrl);
app.post('/api/connections/microsoft/callback', handleMicrosoftCallback);
app.post('/api/connections/sync', triggerSync);
app.post('/api/connections/disconnect/preview', getDisconnectPreview);
app.post('/api/connections/disconnect', disconnectConnection);
// Calendar mappings endpoints (multi-calendar support)
app.post('/api/connections/calendars', getCalendarList);
app.post('/api/connections/calendars/mappings', getCalendarMappings);
app.post('/api/connections/calendars/sync', syncCalendarList);
app.post('/api/connections/calendars/mapping', updateCalendarMapping);
// Webhook endpoint - no auth required (called by Google)
app.post('/api/connections/webhook/google', handleGoogleWebhook);

// Reminder endpoints
app.post('/api/reminders', getUserReminders);
app.post('/api/reminders/create', createUserReminder);
app.post('/api/reminders/update', updateUserReminder);
app.post('/api/reminders/delete', deleteUserReminder);
app.post('/api/reminders/snooze', snoozeUserReminder);
app.post('/api/reminders/dismiss-event', dismissEventReminders);

// Chat endpoints - persistent storage in user schema
app.post('/api/chat/history', getChatHistory);
app.post('/api/chat/message', saveChatMessage);
app.post('/api/chat/messages/batch', saveChatMessagesBatch);
app.post('/api/chat/clear', clearChatHistory);

// Agent endpoints - for LangGraph agent system
app.post('/api/agent/process', addStartTime, processAgentMessage);
app.post('/api/agent/stream', addStartTime, streamAgentMessage);

// Centralized error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log error with context
  console.error('[SERVER] Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Determine error status and message
  let statusCode = 500;
  let errorMessage = 'Internal server error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = 'Invalid input data';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorMessage = 'Unauthorized access';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorMessage = 'Access forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorMessage = 'Resource not found';
  } else if (err.code === 'PGRST116') {
    statusCode = 404;
    errorMessage = 'Resource not found';
  } else if (err.code === '23505') {
    statusCode = 409;
    errorMessage = 'Resource already exists';
  } else if (err.code === '23503') {
    statusCode = 400;
    errorMessage = 'Invalid reference to related resource';
  }
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const finalMessage = isDevelopment ? err.message : errorMessage;
  
  res.status(statusCode).json({ 
    success: false,
    error: finalMessage,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler for undefined routes
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ 
    error: 'Route not found',
    success: false,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown and process error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught Exception:', error);
  // Give time for logging, then exit
  setTimeout(() => process.exit(1), 1000);
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`Agent service running on port ${PORT}`);
    console.log(`[SERVER] Google OAuth config:`, {
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '(not set)',
      connectionCallbackUri: process.env.GOOGLE_CONNECTION_CALLBACK_URI || '(not set, using GOOGLE_REDIRECT_URI)',
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    });

    // Start background jobs
    startWatchRenewalJob();
    startReminderCheckerJob();
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[SERVER] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('[SERVER] HTTP server closed');
      process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('[SERVER] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { app };