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

export async function deleteRatingTopic(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { topic } = req.body;
    if (!topic) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }

    const supabaseService = getSupabaseService();
    const success = await supabaseService.deleteRatingTopic(userId, topic);

    if (!success) {
      res.status(500).json({ error: 'Failed to delete rating topic' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[RATINGS] Error deleting rating topic:', error);
    res.status(500).json({ error: 'Failed to delete rating topic' });
  }
}

export async function updateRatingTopic(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { old_topic, topic, description } = req.body;
    if (!old_topic) {
      res.status(400).json({ error: 'old_topic is required' });
      return;
    }

    const supabaseService = getSupabaseService();
    const success = await supabaseService.updateRatingTopic(userId, old_topic, {
      topic,
      description,
    });

    if (!success) {
      res.status(500).json({ error: 'Failed to update rating topic' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[RATINGS] Error updating rating topic:', error);
    res.status(500).json({ error: 'Failed to update rating topic' });
  }
}

export async function reorderRatingTopics(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { topic_order } = req.body;
    if (!Array.isArray(topic_order)) {
      res.status(400).json({ error: 'topic_order must be an array of topic strings' });
      return;
    }

    const supabaseService = getSupabaseService();
    const success = await supabaseService.reorderRatingTopics(userId, topic_order);

    if (!success) {
      res.status(500).json({ error: 'Failed to reorder ratings' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[RATINGS] Error reordering ratings:', error);
    res.status(500).json({ error: 'Failed to reorder ratings' });
  }
}
