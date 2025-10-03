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

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Agent endpoints - for LangGraph agent system
app.post('/api/agent/process', addStartTime, processAgentMessage);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Agent service running on port ${PORT}`);
});