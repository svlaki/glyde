import { Request, Response } from 'express';
import { SmartInteractionService } from '../services/SmartInteractionService.js';

export async function generateInteractionFromChat(req: Request, res: Response): Promise<Response | void> {
  try {
    const { user_id, chat_context } = req.body;
    
    if (!user_id || !chat_context) {
      return res.status(400).json({ error: 'user_id and chat_context are required' });
    }

    const smartService = new SmartInteractionService();
    
    // Analyze chat context to determine if an interaction is needed
    const lastMessage = chat_context[chat_context.length - 1];
    if (!lastMessage) {
      return res.json({ success: true, interaction: null });
    }
    
    // Look for scheduling-related keywords
    const schedulingKeywords = [
      'schedule', 'book', 'meeting', 'appointment', 'calendar', 
      'tomorrow', 'next week', 'later', 'time', 'when', 'plan'
    ];
    
    const messageText = lastMessage.content.toLowerCase();
    const hasSchedulingIntent = schedulingKeywords.some(keyword => messageText.includes(keyword));
    
    if (!hasSchedulingIntent) {
      return res.json({ success: true, interaction: null });
    }
    
    // Generate a contextual interaction based on the chat
    const interactions = await smartService.generateSmartInteractions(user_id);
    
    // If we have interactions, return the most relevant one
    if (interactions.length > 0) {
      return res.json({
        success: true,
        interaction: interactions[0]
      });
    }
    
    return res.json({ success: true, interaction: null });

  } catch (error) {
    console.error('Error generating interaction from chat:', error);
    return res.status(500).json({ error: 'Failed to generate interaction' });
  }
}