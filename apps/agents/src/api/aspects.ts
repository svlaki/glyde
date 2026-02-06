import { Request, Response } from 'express';
import aspectService from '../services/AspectService.js';

export async function getUserAspects(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching aspects for user:', userId);

    const aspects = await aspectService.getAspects(userId);

    // Aspects are created during onboarding
    // If user has no aspects, they haven't completed onboarding yet
    // or their onboarding was done before aspect creation was added
    res.json({
      success: true,
      aspects: aspects
    });

  } catch (error) {
    console.error('Error fetching user aspects:', error);
    res.status(500).json({ error: 'Failed to fetch user aspects' });
  }
}

export async function createUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { user_id: _ignoredUserId, ...aspectData } = req.body ?? {};

    if (!aspectData.name || !aspectData.color) {
      res.status(400).json({ error: 'name and color are required' });
      return;
    }

    // Validate aspect data
    if (typeof aspectData.name !== 'string' || aspectData.name.trim().length === 0) {
      res.status(400).json({ error: 'Aspect name must be a non-empty string' });
      return;
    }

    if (typeof aspectData.color !== 'string' || !aspectData.color.match(/^#[0-9A-Fa-f]{6}$/)) {
      res.status(400).json({ error: 'Color must be a valid hex color (e.g., #3b82f6)' });
      return;
    }

    console.log('Creating aspect for user:', userId);

    const aspect = await aspectService.createAspect(userId, {
      name: aspectData.name.trim(),
      color: aspectData.color.trim(),
      description: aspectData.description?.trim(),
      context: aspectData.context || {}
    });

    if (!aspect) {
      res.status(500).json({ error: 'Failed to create aspect - service returned null' });
      return;
    }

    res.json({
      success: true,
      aspect: aspect
    });

  } catch (error) {
    console.error('Error creating user aspect:', error);
    res.status(500).json({ error: 'Failed to create user aspect' });
  }
}

export async function updateUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { aspect_id, ...updates } = req.body ?? {};

    if (!aspect_id) {
      res.status(400).json({ error: 'aspect_id is required' });
      return;
    }

    // Validate updates
    if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length === 0)) {
      res.status(400).json({ error: 'Aspect name must be a non-empty string' });
      return;
    }

    if (updates.color !== undefined && (typeof updates.color !== 'string' || !updates.color.match(/^#[0-9A-Fa-f]{6}$/))) {
      res.status(400).json({ error: 'Color must be a valid hex color (e.g., #3b82f6)' });
      return;
    }

    console.log('Updating aspect:', aspect_id, 'for user:', userId);

    const aspect = await aspectService.updateAspect(userId, aspect_id, {
      name: updates.name?.trim(),
      color: updates.color?.trim(),
      description: updates.description?.trim(),
      context: updates.context
    });

    if (!aspect) {
      res.status(404).json({ error: 'Aspect not found or failed to update' });
      return;
    }

    res.json({
      success: true,
      aspect: aspect
    });

  } catch (error) {
    console.error('Error updating user aspect:', error);
    res.status(500).json({ error: 'Failed to update user aspect' });
  }
}

export async function deleteUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { aspect_id } = req.body ?? {};

    if (!aspect_id) {
      res.status(400).json({ error: 'aspect_id is required' });
      return;
    }

    console.log('Deleting aspect:', aspect_id, 'for user:', userId);

    await aspectService.deleteAspect(userId, aspect_id);

    res.json({
      success: true,
      message: 'Aspect deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user aspect:', error);
    res.status(500).json({ error: 'Failed to delete user aspect' });
  }
}

export async function getAspectColor(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { aspect_name } = req.body ?? {};

    if (!aspect_name) {
      res.status(400).json({ error: 'aspect_name is required' });
      return;
    }

    const color = await aspectService.getAspectColor(userId, aspect_name);

    res.json({
      success: true,
      color: color
    });

  } catch (error) {
    console.error('Error fetching aspect color:', error);
    res.status(500).json({ error: 'Failed to fetch aspect color' });
  }
}
