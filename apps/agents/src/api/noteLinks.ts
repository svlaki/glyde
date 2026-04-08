import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getNoteGraph(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const graph = await getSupabaseService().getNoteGraph(userId);

    res.json({
      success: true,
      ...graph
    });
  } catch (error) {
    console.error('Error fetching note graph:', error);
    res.status(500).json({ error: 'Failed to fetch note graph' });
  }
}

export async function syncNoteLinks(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { source_note_id, linked_titles } = req.body ?? {};

    if (!source_note_id) {
      res.status(400).json({ error: 'source_note_id is required' });
      return;
    }

    if (!Array.isArray(linked_titles)) {
      res.status(400).json({ error: 'linked_titles must be an array' });
      return;
    }

    const result = await getSupabaseService().syncNoteLinks(userId, source_note_id, linked_titles);

    res.json(result);
  } catch (error) {
    console.error('Error syncing note links:', error);
    res.status(500).json({ error: 'Failed to sync note links' });
  }
}

export async function getBacklinks(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { note_id } = req.body ?? {};

    if (!note_id) {
      res.status(400).json({ error: 'note_id is required' });
      return;
    }

    const backlinks = await getSupabaseService().getNoteBacklinks(userId, note_id);

    res.json({
      success: true,
      backlinks
    });
  } catch (error) {
    console.error('Error fetching backlinks:', error);
    res.status(500).json({ error: 'Failed to fetch backlinks' });
  }
}

export async function searchNotes(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query } = req.body ?? {};

    if (typeof query !== 'string') {
      res.status(400).json({ error: 'query string is required' });
      return;
    }

    const results = await getSupabaseService().searchNotesByTitle(userId, query);

    res.json({
      success: true,
      notes: results
    });
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
}

export async function searchNotesFulltext(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query } = req.body ?? {};

    if (typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'query string is required' });
      return;
    }

    const results = await getSupabaseService().searchNotesFulltext(userId, query.trim());

    res.json({
      success: true,
      notes: results
    });
  } catch (error) {
    console.error('Error in fulltext search:', error);
    res.status(500).json({ error: 'Failed to search notes' });
  }
}
