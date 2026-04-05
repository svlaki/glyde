import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserNotes(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const notes = await getSupabaseService().getAllNotes(userId);

    res.json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Error fetching user notes:', error);
    res.status(500).json({ error: 'Failed to fetch user notes' });
  }
}

export async function createUserNotes(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, content, aspect_id, horizon_start, horizon_end, status } = req.body ?? {};

    const notes = await getSupabaseService().createNotes(userId, {
      title,
      content,
      aspectId: aspect_id || undefined,
      horizonStart: horizon_start,
      horizonEnd: horizon_end,
      status
    });

    if (!notes) {
      res.status(500).json({ error: 'Failed to create notes' });
      return;
    }

    res.json({
      success: true,
      note: notes
    });
  } catch (error) {
    console.error('Error creating user notes:', error);
    res.status(500).json({ error: 'Failed to create user notes' });
  }
}

export async function updateUserNotes(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { plan_id, title, content, aspect_id, horizon_start, horizon_end, status } = req.body ?? {};

    if (!plan_id) {
      res.status(400).json({ error: 'plan_id is required' });
      return;
    }

    const notes = await getSupabaseService().updateNotes(userId, plan_id, {
      title,
      content,
      aspectId: aspect_id,
      horizonStart: horizon_start,
      horizonEnd: horizon_end,
      status
    });

    if (!notes) {
      res.status(500).json({ error: 'Failed to update notes' });
      return;
    }

    res.json({
      success: true,
      note: notes
    });
  } catch (error) {
    console.error('Error updating user notes:', error);
    res.status(500).json({ error: 'Failed to update user notes' });
  }
}

export async function deleteUserNotes(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { plan_id } = req.body ?? {};

    if (!plan_id) {
      res.status(400).json({ error: 'plan_id is required' });
      return;
    }

    const result = await getSupabaseService().deleteNotes(userId, plan_id);

    res.json(result);
  } catch (error) {
    console.error('Error deleting user notes:', error);
    res.status(500).json({ error: 'Failed to delete user notes' });
  }
}
