import { Request, Response } from 'express';
import { ZepMemoryService } from '../services/ZepMemoryService.js';

export async function getChatHistory(req: Request, res: Response): Promise<void> {
  const { user_id, session_id, limit = 50 } = req.body;

  if (!user_id || !session_id) {
    res.status(400).json({
      success: false,
      error: 'user_id and session_id are required'
    });
    return;
  }

  try {
    const zepService = new ZepMemoryService();

    // Search for conversation history using the public searchMemory method
    const messages = await zepService.searchMemory(user_id, 'conversation history messages', limit);

    // Format messages for frontend
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      content: msg.content || '',
      sender: msg.role === 'user' ? 'user' : 'assistant',
      timestamp: msg.timestamp || new Date().toISOString()
    }));

    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch chat history'
    });
  }
}
