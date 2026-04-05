import { Request, Response } from 'express';
import { MemoryService } from '../services/MemoryService.js';

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
    const memoryService = MemoryService.getInstance();
    const context = await memoryService.getUserContext(user_id);

    const message = {
      id: `context_${Date.now()}`,
      content: context || 'No context found for this user',
      sender: 'system',
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, messages: [message] });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch chat history'
    });
  }
}
