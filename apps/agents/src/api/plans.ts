import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserPlan(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const plan = await getSupabaseService().getPlan(userId);

    res.json({
      success: true,
      plan: plan
    });
  } catch (error) {
    console.error('Error fetching user plan:', error);
    res.status(500).json({ error: 'Failed to fetch user plan' });
  }
}

export async function createUserPlan(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, content, horizon_start, horizon_end, status } = req.body ?? {};

    const plan = await getSupabaseService().createPlan(userId, {
      title,
      content,
      horizonStart: horizon_start,
      horizonEnd: horizon_end,
      status
    });

    if (!plan) {
      res.status(500).json({ error: 'Failed to create plan' });
      return;
    }

    res.json({
      success: true,
      plan: plan
    });
  } catch (error) {
    console.error('Error creating user plan:', error);
    res.status(500).json({ error: 'Failed to create user plan' });
  }
}

export async function updateUserPlan(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { plan_id, title, content, horizon_start, horizon_end, status } = req.body ?? {};

    if (!plan_id) {
      res.status(400).json({ error: 'plan_id is required' });
      return;
    }

    const plan = await getSupabaseService().updatePlan(userId, plan_id, {
      title,
      content,
      horizonStart: horizon_start,
      horizonEnd: horizon_end,
      status
    });

    if (!plan) {
      res.status(500).json({ error: 'Failed to update plan' });
      return;
    }

    res.json({
      success: true,
      plan: plan
    });
  } catch (error) {
    console.error('Error updating user plan:', error);
    res.status(500).json({ error: 'Failed to update user plan' });
  }
}

export async function deleteUserPlan(req: Request, res: Response): Promise<void> {
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

    const result = await getSupabaseService().deletePlan(userId, plan_id);

    res.json(result);
  } catch (error) {
    console.error('Error deleting user plan:', error);
    res.status(500).json({ error: 'Failed to delete user plan' });
  }
}
