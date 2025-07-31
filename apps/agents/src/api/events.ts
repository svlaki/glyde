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
    const { user_id, start_date, end_date } = req.body;
    
    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching events for user:', user_id);

    const events = await getSupabaseService().getEvents(user_id, start_date, end_date);
    
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
    const { user_id, event } = req.body;
    
    if (!user_id || !event) {
      res.status(400).json({ error: 'user_id and event are required' });
      return;
    }

    console.log('Creating event for user:', user_id);

    const createdEvent = await getSupabaseService().createEvent(user_id, event);
    
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
    const { user_id, event_id, event } = req.body;
    
    if (!user_id || !event_id || !event) {
      res.status(400).json({ error: 'user_id, event_id, and event are required' });
      return;
    }

    console.log('Updating event for user:', user_id);

    const updatedEvent = await getSupabaseService().updateEvent(user_id, event_id, event);
    
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
    const { user_id, event_id } = req.body;
    
    if (!user_id || !event_id) {
      res.status(400).json({ error: 'user_id and event_id are required' });
      return;
    }

    console.log('Deleting event for user:', user_id);

    const result = await getSupabaseService().deleteEvent(user_id, event_id);
    
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