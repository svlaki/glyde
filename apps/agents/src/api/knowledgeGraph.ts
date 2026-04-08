import { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabaseService } from '../services/SupabaseService.js';

const entityLinkSchema = z.object({
  source_type: z.enum(['note', 'goal', 'aspect']),
  source_id: z.string().uuid(),
  target_type: z.enum(['note', 'goal', 'aspect']),
  target_id: z.string().uuid(),
});

const positionsSchema = z.record(z.string().uuid(), z.object({ x: z.number(), y: z.number() }));

export async function getKnowledgeGraph(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [graph, positions] = await Promise.all([
      getSupabaseService().getKnowledgeGraph(userId),
      getSupabaseService().getGraphPositions(userId),
    ]);
    res.json({ success: true, ...graph, positions });
  } catch (error) {
    console.error('Error fetching knowledge graph:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge graph' });
  }
}

export async function createEntityLink(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsed = entityLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { source_type, source_id, target_type, target_id } = parsed.data;
    const link = await getSupabaseService().createEntityLink(userId, source_type, source_id, target_type, target_id);

    if (!link) {
      res.status(400).json({ error: 'Failed to create link (may already exist)' });
      return;
    }

    res.json({ success: true, link });
  } catch (error) {
    console.error('Error creating entity link:', error);
    res.status(500).json({ error: 'Failed to create entity link' });
  }
}

export async function deleteEntityLink(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { link_id } = req.body ?? {};
    if (!link_id || typeof link_id !== 'string') {
      res.status(400).json({ error: 'link_id is required' });
      return;
    }

    const success = await getSupabaseService().deleteEntityLink(userId, link_id);
    res.json({ success });
  } catch (error) {
    console.error('Error deleting entity link:', error);
    res.status(500).json({ error: 'Failed to delete entity link' });
  }
}

export async function saveGraphPositions(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { positions } = req.body ?? {};
    if (!positions || typeof positions !== 'object') {
      res.status(400).json({ error: 'positions object is required' });
      return;
    }

    const success = await getSupabaseService().saveGraphPositions(userId, positions);
    res.json({ success });
  } catch (error) {
    console.error('Error saving graph positions:', error);
    res.status(500).json({ error: 'Failed to save positions' });
  }
}
