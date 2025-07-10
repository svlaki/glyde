import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateEventEmbedding, generateChatEmbedding, searchSimilarContent } from './embedding.js';
import { handleChatMessage, getChatHistory } from './chat.js';

dotenv.config();

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
app.post('/api/chat/history', getChatHistory);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Agent service running on port ${PORT}`);
});