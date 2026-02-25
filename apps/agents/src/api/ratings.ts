import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserRatings(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, topic } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const supabaseService = getSupabaseService();
    const ratings = await supabaseService.getRatings(user_id, topic);

    res.json({ success: true, ratings });
  } catch (error) {
    console.error('[RATINGS] Error fetching ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
}

export async function getRatingSummary(req: Request, res: Response): Promise<void> {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const supabaseService = getSupabaseService();
    const summary = await supabaseService.getRatingSummary(user_id);

    res.json({ success: true, summary });
  } catch (error) {
    console.error('[RATINGS] Error fetching rating summary:', error);
    res.status(500).json({ error: 'Failed to fetch rating summary' });
  }
}

export async function createRating(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, topic, score, description, aspect_id, notes } = req.body;

    if (!user_id || !topic || score === undefined) {
      res.status(400).json({ error: 'user_id, topic, and score are required' });
      return;
    }

    if (score < 1 || score > 10) {
      res.status(400).json({ error: 'score must be between 1 and 10' });
      return;
    }

    const supabaseService = getSupabaseService();
    const rating = await supabaseService.createRating(user_id, {
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
