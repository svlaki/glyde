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
import { generateEventEmbedding, generateChatEmbedding, searchSimilarContent } from './embedding.js';
import { handleChatMessage, getChatHistory, handleStreamingChat } from './chat.js';
import { createUserSchema } from './user.js';
import { getUserEvents, createUserEvent, updateUserEvent, deleteUserEvent } from './events.js';
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

// Embedding endpoints
app.post('/api/embeddings/event', generateEventEmbedding);
app.post('/api/embeddings/chat', generateChatEmbedding);
app.post('/api/embeddings/search', searchSimilarContent);

// Chat endpoints
app.post('/api/chat', handleChatMessage);
app.post('/api/chat/stream', handleStreamingChat);
app.post('/api/chat/history', getChatHistory);

// User endpoints
app.post('/api/user/create-schema', createUserSchema);

// Events endpoints
app.post('/api/events', getUserEvents);
app.post('/api/events/create', createUserEvent);
app.post('/api/events/update', updateUserEvent);
app.post('/api/events/delete', deleteUserEvent);

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