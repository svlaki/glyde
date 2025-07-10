import { Request, Response } from 'express';
import { SupabaseService } from '../services/SupabaseService.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { ConversationAgent } from '../agents/conversation/ConversationAgent.js';

const supabaseService = new SupabaseService();
const embeddingService = new EmbeddingService();
const conversationAgent = new ConversationAgent();

export async function handleChatMessage(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, message, session_id } = req.body;
    
    if (!user_id || !message || !session_id) {
      res.status(400).json({ error: 'Missing required fields: user_id, message, session_id' });
      return;
    }

    console.log('Processing chat message:', { user_id, message, session_id });

    // Generate embedding for the message
    const embedding = await embeddingService.generateEmbedding(message);

    // Store user message with embedding
    const userMessage = await supabaseService.addChatMessage(user_id, {
      session_id,
      user_id,
      content: message,
      sender: 'user',
      timestamp: new Date().toISOString(),
      embedding
    });

    if (!userMessage) {
      res.status(500).json({ error: 'Failed to store user message' });
      return;
    }

    // Process the message through the conversation agent
    const agentResponse = await conversationAgent.processMessage(user_id, message);

    // Generate embedding for the agent response
    const responseEmbedding = await embeddingService.generateEmbedding(agentResponse);

    // Store agent response with embedding
    const aiMessage = await supabaseService.addChatMessage(user_id, {
      session_id,
      user_id,
      content: agentResponse,
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      embedding: responseEmbedding
    });

    res.json({
      success: true,
      response: agentResponse,
      id: aiMessage?.id || Date.now().toString()
    });

  } catch (error) {
    console.error('Error handling chat message:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
}

export async function getChatHistory(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, session_id } = req.body;
    
    if (!user_id || !session_id) {
      res.status(400).json({ error: 'Missing required fields: user_id, session_id' });
      return;
    }

    console.log('Getting chat history for:', { user_id, session_id });

    const messages = await supabaseService.getChatMessages(user_id, session_id);
    
    // Transform messages to match frontend format
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      timestamp: msg.timestamp
    }));

    res.json({
      success: true,
      messages: formattedMessages
    });

  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
}