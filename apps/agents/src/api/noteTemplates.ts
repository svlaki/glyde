import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getNoteTemplates(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const templates = await getSupabaseService().getNoteTemplates(userId);

    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching note templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

export async function createNoteTemplate(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, content, aspect_id } = req.body ?? {};

    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const template = await getSupabaseService().createNoteTemplate(userId, {
      title,
      content: content || '',
      aspect_id,
    });

    if (!template) {
      res.status(500).json({ error: 'Failed to create template' });
      return;
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error('Error creating note template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
}

export async function deleteNoteTemplate(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { template_id } = req.body ?? {};

    if (!template_id) {
      res.status(400).json({ error: 'template_id is required' });
      return;
    }

    const result = await getSupabaseService().deleteNoteTemplate(userId, template_id);

    res.json(result);
  } catch (error) {
    console.error('Error deleting note template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
}
