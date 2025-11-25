import { env, isDevelopment, ENV_PATH } from '../utils/env.js';
import { initializeSupabase } from '../services/SupabaseService.js';

// Set environment variables explicitly if needed
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these variables before starting the server.');
  process.exit(1);
}

// Validate environment variables format
if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
  console.error('❌ SUPABASE_URL must be a valid HTTPS URL');
  process.exit(1);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length < 20) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)');
  process.exit(1);
}

initializeSupabase();

import express from 'express';
import cors from 'cors';
import { createUserSchema } from './user.js';
import { getUserEvents, createUserEvent, updateUserEvent, deleteUserEvent } from './events.js';
import { getUserTasks, createUserTask, updateUserTask, deleteUserTask, completeUserTask } from './tasks.js';
import { getUserGoals, createUserGoal, updateUserGoal, deleteUserGoal, addGoalCheckIn, getGoalCheckIns } from './goals.js';
import { getUserProfile, updateUserProfile, updateProfileField, batchUpdateProfileFields } from './profile.js';
import { getUserCategories, createUserCategory, updateUserCategory, deleteUserCategory, getCategoryColor } from './categories.js';
import { getPendingInteractions, respondToInteraction, clearUserInteractions } from './interactions.js';
import { processAgentMessage, addStartTime } from './agent.js';
import { authenticateRequest } from './middleware/auth.js';

const app = express();
const PORT = env.PORT;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware (simple in-memory store)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
// Rate limiting DISABLED for development
const RATE_LIMIT_DISABLED = true;
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 1000;

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (RATE_LIMIT_DISABLED) {
    next();
    return;
  }
  
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
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
    console.log(`📝 [SERVER] ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
  });
}

// Authentication middleware - validates JWT and sets req.authUserId
// This runs early to ensure protected routes have user context
app.use(authenticateRequest);

// Input sanitization middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  // Skip sanitization for health check and agent endpoint
  if (req.url.includes('/health') || req.url.includes('/api/agent/process')) {
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
  // Skip validation for health check and agent endpoint
  if (req.url.includes('/health') || req.url.includes('/api/agent/process')) {
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
app.post('/api/events/create', createUserEvent);
app.post('/api/events/update', updateUserEvent);
app.post('/api/events/delete', deleteUserEvent);

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

// Profile endpoints
app.post('/api/profile', getUserProfile);
app.post('/api/profile/update', updateUserProfile);
app.post('/api/profile/field', updateProfileField);
app.post('/api/profile/batch-update', batchUpdateProfileFields);

// Categories endpoints
app.post('/api/categories', getUserCategories);
app.post('/api/categories/create', createUserCategory);
app.post('/api/categories/update', updateUserCategory);
app.post('/api/categories/delete', deleteUserCategory);
app.post('/api/categories/color', getCategoryColor);

// Interaction endpoints
app.post('/api/interactions/pending', getPendingInteractions);
app.post('/api/interactions/respond', respondToInteraction);
app.post('/api/interactions/clear', clearUserInteractions);

// Chat endpoints
app.post('/api/chat/history', async (req, res) => {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { session_id, limit = 50 } = req.body ?? {};

    // For now, return empty array - chat history is managed in frontend
    // This endpoint exists to prevent 404 errors
    res.json({
      success: true,
      messages: []
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chat history' });
  }
});

// Agent endpoints - for LangGraph agent system
app.post('/api/agent/process', addStartTime, processAgentMessage);

// Centralized error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log error with context
  console.error('❌ [SERVER] Unhandled error:', {
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Agent service running on port ${PORT}`);
  });
}

export { app };