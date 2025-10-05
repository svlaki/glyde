import { Request, Response } from 'express';
import { SupabaseService } from '../services/SupabaseService.js';

let supabaseService: SupabaseService | null = null;

function getSupabaseService(): SupabaseService {
  if (!supabaseService) {
    supabaseService = new SupabaseService();
  }
  return supabaseService;
}

export async function getUserEvents(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { start_date, end_date } = req.body;

    console.log('Fetching events for user:', userId);

    const events = await getSupabaseService().getEvents(userId, start_date, end_date);
    
    res.json({
      success: true,
      events: events
    });

  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ error: 'Failed to fetch user events' });
  }
}

export async function createUserEvent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { user_id: _ignoredUserId, ...eventData } = req.body ?? {};

    console.log('Creating event for user:', userId);
    console.log('Event data:', eventData);

    const createdEvent = await getSupabaseService().createEvent(userId, eventData);
    
    if (createdEvent) {
      res.json({
        success: true,
        event: createdEvent
      });
    } else {
      res.status(500).json({ error: 'Failed to create event' });
    }

  } catch (error) {
    console.error('Error creating user event:', error);
    res.status(500).json({ error: 'Failed to create user event' });
  }
}

export async function updateUserEvent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { event_id, ...eventData } = req.body ?? {};

    if (!event_id) {
      res.status(400).json({ error: 'event_id is required' });
      return;
    }

    console.log('Updating event for user:', userId);
    console.log('Event updates:', eventData);

    const updatedEvent = await getSupabaseService().updateEvent(userId, event_id, eventData);
    
    if (updatedEvent) {
      res.json({
        success: true,
        event: updatedEvent
      });
    } else {
      res.status(500).json({ error: 'Failed to update event' });
    }

  } catch (error) {
    console.error('Error updating user event:', error);
    res.status(500).json({ error: 'Failed to update user event' });
  }
}

export async function deleteUserEvent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { event_id } = req.body ?? {};

    if (!event_id) {
      res.status(400).json({ error: 'event_id is required' });
      return;
    }

    console.log('Deleting event for user:', userId);

    const result = await getSupabaseService().deleteEvent(userId, event_id);
    
    if (result.success) {
      res.json({
        success: true
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to delete event' });
    }

  } catch (error) {
    console.error('Error deleting user event:', error);
    res.status(500).json({ error: 'Failed to delete user event' });
  }
}