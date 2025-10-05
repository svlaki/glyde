import { Request, Response } from 'express';
import { SupabaseService } from '../services/SupabaseService.js';
import { logger } from '../utils/logger.js';

// Singleton pattern for service instance
let supabaseService: SupabaseService | null = null;

function getSupabaseService(): SupabaseService {
  if (!supabaseService) {
    supabaseService = new SupabaseService();
  }
  return supabaseService;
}

// Helper function to validate user_id
function validateUserId(userId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

// Helper function to send error response
function sendErrorResponse(res: Response, statusCode: number, message: string, meta?: any): void {
  logger.error(`API Error: ${message}`, meta);
  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
}

export async function getUserEvents(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, start_date, end_date } = req.body;
    
    if (!user_id) {
      sendErrorResponse(res, 400, 'user_id is required');
      return;
    }

    if (!validateUserId(user_id)) {
      sendErrorResponse(res, 400, 'Invalid user_id format');
      return;
    }

    logger.info('Fetching events for user', { user_id, start_date, end_date });

    const events = await getSupabaseService().getEvents(user_id, start_date, end_date);
    
    logger.info('Successfully fetched events', { count: events.length, user_id });
    
    res.json({
      success: true,
      events: events
    });

  } catch (error) {
    logger.error('Error fetching user events', { error: error instanceof Error ? error.message : error });
    sendErrorResponse(res, 500, 'Failed to fetch user events', { error });
  }
}

export async function createUserEvent(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, ...eventData } = req.body;
    
    if (!user_id) {
      res.status(400).json({ 
        success: false,
        error: 'user_id is required' 
      });
      return;
    }

    // Validate required event fields
    if (!eventData.title || typeof eventData.title !== 'string' || eventData.title.trim().length === 0) {
      res.status(400).json({ 
        success: false,
        error: 'Event title is required and must be a non-empty string' 
      });
      return;
    }

    if (!eventData.start_time || !eventData.end_time) {
      res.status(400).json({ 
        success: false,
        error: 'start_time and end_time are required' 
      });
      return;
    }

    // Validate date format
    const startTime = new Date(eventData.start_time);
    const endTime = new Date(eventData.end_time);
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      res.status(400).json({ 
        success: false,
        error: 'Invalid date format for start_time or end_time' 
      });
      return;
    }

    if (startTime >= endTime) {
      res.status(400).json({ 
        success: false,
        error: 'start_time must be before end_time' 
      });
      return;
    }

    console.log('Creating event for user:', user_id);
    console.log('Event data:', eventData);

    const createdEvent = await getSupabaseService().createEvent(user_id, {
      ...eventData,
      title: eventData.title.trim()
    });
    
    if (createdEvent) {
      res.json({
        success: true,
        event: createdEvent
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to create event - database operation returned null' 
      });
    }

  } catch (error) {
    console.error('Error creating user event:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create user event';
    if (error instanceof Error) {
      if (error.message.includes('duplicate')) {
        errorMessage = 'An event with this information already exists';
      } else if (error.message.includes('constraint')) {
        errorMessage = 'Invalid event data provided';
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
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