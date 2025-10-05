import dotenv from 'dotenv';

// Configure dotenv first
dotenv.config({ path: '.env' });

// Set environment variables explicitly if needed
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

console.log('Environment variables loaded successfully');

// Initialize Supabase client first
import { initializeSupabase } from '../services/SupabaseService.js';
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
import { generateInteractionFromChat } from './chat-interactions.js';
import { authenticateRequest } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size

// Request logging middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`📝 [SERVER] ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Input validation middleware
app.use(authenticateRequest);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Intelligent interactions
app.post('/api/interactions/from-chat', generateInteractionFromChat);

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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [SERVER] Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment ? err.message : 'Internal server error';
  
  res.status(500).json({ 
    error: errorMessage,
    success: false,
    timestamp: new Date().toISOString()
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