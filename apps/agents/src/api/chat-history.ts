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

    // Get context for the thread (session_id is the threadId)
    // Zep's thread.getUserContext() returns structured context including conversation history
    const context = await zepService.getThreadContext(session_id);

    // For now, return a simple message with the context
    // In a full implementation, you'd parse Zep's structured response
    const message = {
      id: `context_${Date.now()}`,
      content: context || 'No context found for this thread',
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
