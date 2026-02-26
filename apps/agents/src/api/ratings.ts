import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserRatings(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { topic } = req.body;
    const supabaseService = getSupabaseService();
    const ratings = await supabaseService.getRatings(userId, topic);

    res.json({ success: true, ratings });
  } catch (error) {
    console.error('[RATINGS] Error fetching ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
}

export async function getRatingSummary(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const supabaseService = getSupabaseService();
    const summary = await supabaseService.getRatingSummary(userId);

    res.json({ success: true, summary });
  } catch (error) {
    console.error('[RATINGS] Error fetching rating summary:', error);
    res.status(500).json({ error: 'Failed to fetch rating summary' });
  }
}

export async function createRating(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { topic, score, description, aspect_id, notes } = req.body;

    if (!topic || score === undefined) {
      res.status(400).json({ error: 'topic and score are required' });
      return;
    }

    if (score < 1 || score > 10) {
      res.status(400).json({ error: 'score must be between 1 and 10' });
      return;
    }

    const supabaseService = getSupabaseService();
    const rating = await supabaseService.createRating(userId, {
      topic,
      score,
      description,
      aspectId: aspect_id,
      notes,
    });

    if (!rating) {
      res.status(500).json({ error: 'Failed to create rating' });
      return;
    }

    res.json({ success: true, rating });
  } catch (error) {
    console.error('[RATINGS] Error creating rating:', error);
    res.status(500).json({ error: 'Failed to create rating' });
  }
}
