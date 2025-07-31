import { Request, Response } from 'express';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { SupabaseService } from '../services/SupabaseService.js';

let embeddingService: EmbeddingService | null = null;
let supabaseService: SupabaseService | null = null;

function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
  return embeddingService;
}

function getSupabaseService(): SupabaseService {
  if (!supabaseService) {
    supabaseService = new SupabaseService();
  }
  return supabaseService;
}

export async function generateEventEmbedding(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, event } = req.body;
    
    if (!user_id || !event) {
      res.status(400).json({ error: 'Missing user_id or event data' });
      return;
    }

    // Use SupabaseService which calls the Edge Function
    console.log('Step 1: Creating event via SupabaseService...');
    console.log('User ID:', user_id);
    console.log('Event data:', JSON.stringify(event, null, 2));
    
    let result;
    if (event.id) {
      console.log('Step 2: Updating existing event...');
      result = await getSupabaseService().updateEvent(user_id, event.id, event);
    } else {
      console.log('Step 2: Creating new event...');
      result = await getSupabaseService().createEvent(user_id, event);
    }
    console.log('Step 2 complete: Event operation finished');

    res.json({
      success: true,
      event: result,
      embedding_generated: true
    });
  } catch (error) {
    console.error('Error generating event embedding:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Error keys:', Object.keys(error || {}));
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    res.status(500).json({ error: 'Failed to generate event embedding', details: errorMessage });
  }
}

export async function generateChatEmbedding(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, message, session_id } = req.body;
    
    if (!user_id || !message || !session_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Generate embedding for the message
    const embedding = await getEmbeddingService().generateEmbedding(message);

    // Store the message with embedding
    const result = await getSupabaseService().addChatMessage(user_id, {
      session_id,
      user_id,
      content: message,
      embedding,
      sender: 'user',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: result,
      embedding_generated: true
    });
  } catch (error) {
    console.error('Error generating chat embedding:', error);
    res.status(500).json({ error: 'Failed to generate chat embedding' });
  }
}

export async function searchSimilarContent(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, query, type = 'both', limit = 10 } = req.body;
    
    if (!user_id || !query) {
      res.status(400).json({ error: 'Missing user_id or query' });
      return;
    }

    const results: any = {};

    if (type === 'events' || type === 'both') {
      results.events = await getEmbeddingService().searchSimilarEvents(user_id, query, limit);
    }

    if (type === 'chats' || type === 'both') {
      results.chats = await getEmbeddingService().searchSimilarChats(user_id, query, limit);
    }

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error searching similar content:', error);
    res.status(500).json({ error: 'Failed to search similar content' });
  }
}