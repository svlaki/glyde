import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';
import { logger } from '../utils/logger.js';

// Helper function to validate UUID format
function validateUserId(userId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
  metadata?: Record<string, any>;
}

/**
 * GET /api/chat/history
 * Retrieves chat history for a user from their schema
 */
export async function getChatHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!validateUserId(userId)) {
      res.status(400).json({ success: false, error: 'Invalid user_id format' });
      return;
    }

    const { session_id, limit = 100 } = req.body ?? {};
    const client = getSupabaseService().getClient();

    // Query public.chat_messages table
    let query = client
      .from('chat_messages')
      .select('id, session_id, user_id, content, role, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(Math.min(limit, 500)); // Cap at 500 messages

    // Filter by session if provided
    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching chat history', { error: error.message, userId });
      res.status(500).json({ success: false, error: 'Failed to fetch chat history' });
      return;
    }

    const messages: ChatMessage[] = (data || []).map((msg: any) => ({
      id: msg.id,
      session_id: msg.session_id,
      user_id: msg.user_id,
      content: msg.content,
      sender: msg.role,
      created_at: msg.created_at,
    }));

    logger.info('Fetched chat history', { userId, messageCount: messages.length });
    res.json({ success: true, messages });

  } catch (error) {
    logger.error('Exception fetching chat history', { error: error instanceof Error ? error.message : error });
    res.status(500).json({ success: false, error: 'Failed to fetch chat history' });
  }
}

/**
 * POST /api/chat/message
 * Saves a single chat message to the user's schema
 */
export async function saveChatMessage(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!validateUserId(userId)) {
      res.status(400).json({ success: false, error: 'Invalid user_id format' });
      return;
    }

    const { session_id, content, sender, metadata } = req.body ?? {};

    // Validate required fields
    if (!session_id || typeof session_id !== 'string') {
      res.status(400).json({ success: false, error: 'session_id is required' });
      return;
    }

    if (!content || typeof content !== 'string') {
      res.status(400).json({ success: false, error: 'content is required' });
      return;
    }

    if (!sender || !['user', 'assistant'].includes(sender)) {
      res.status(400).json({ success: false, error: 'sender must be "user" or "assistant"' });
      return;
    }

    const client = getSupabaseService().getClient();

    const messageData = {
      session_id,
      user_id: userId,
      content: content.substring(0, 50000), // Limit content length
      role: sender,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      logger.error('Error saving chat message', { error: error.message, userId });
      res.status(500).json({ success: false, error: 'Failed to save message' });
      return;
    }

    logger.info('Saved chat message', { userId, messageId: data.id, sender });
    res.json({ success: true, message: data });

  } catch (error) {
    logger.error('Exception saving chat message', { error: error instanceof Error ? error.message : error });
    res.status(500).json({ success: false, error: 'Failed to save message' });
  }
}

/**
 * POST /api/chat/messages/batch
 * Saves multiple chat messages at once (for syncing)
 */
export async function saveChatMessagesBatch(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!validateUserId(userId)) {
      res.status(400).json({ success: false, error: 'Invalid user_id format' });
      return;
    }

    const { messages } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, error: 'messages array is required' });
      return;
    }

    // Limit batch size
    if (messages.length > 100) {
      res.status(400).json({ success: false, error: 'Maximum 100 messages per batch' });
      return;
    }

    const client = getSupabaseService().getClient();

    // Validate and prepare messages
    const preparedMessages = messages.map((msg: any) => ({
      session_id: msg.session_id || 'default',
      user_id: userId,
      content: (msg.content || '').substring(0, 50000),
      role: ['user', 'assistant'].includes(msg.sender) ? msg.sender : 'user',
      created_at: msg.created_at || msg.timestamp || new Date().toISOString(),
    }));

    const { data, error } = await client
      .from('chat_messages')
      .insert(preparedMessages)
      .select();

    if (error) {
      logger.error('Error saving chat messages batch', { error: error.message, userId });
      res.status(500).json({ success: false, error: 'Failed to save messages' });
      return;
    }

    logger.info('Saved chat messages batch', { userId, count: data?.length || 0 });
    res.json({ success: true, messages: data, count: data?.length || 0 });

  } catch (error) {
    logger.error('Exception saving chat messages batch', { error: error instanceof Error ? error.message : error });
    res.status(500).json({ success: false, error: 'Failed to save messages' });
  }
}

/**
 * DELETE /api/chat/clear
 * Clears chat history for a session or all sessions
 */
export async function clearChatHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!validateUserId(userId)) {
      res.status(400).json({ success: false, error: 'Invalid user_id format' });
      return;
    }

    const { session_id } = req.body ?? {};
    const client = getSupabaseService().getClient();

    let query = client
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    // Filter by session if provided
    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    const { error } = await query;

    if (error) {
      logger.error('Error clearing chat history', { error: error.message, userId });
      res.status(500).json({ success: false, error: 'Failed to clear chat history' });
      return;
    }

    logger.info('Cleared chat history', { userId, session_id: session_id || 'all' });
    res.json({ success: true, message: 'Chat history cleared' });

  } catch (error) {
    logger.error('Exception clearing chat history', { error: error instanceof Error ? error.message : error });
    res.status(500).json({ success: false, error: 'Failed to clear chat history' });
  }
}
