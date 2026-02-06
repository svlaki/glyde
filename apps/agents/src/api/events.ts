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
    const { user_id, event_id, ...eventDataUpdate } = req.body ?? {};
    
    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    if (!validateUserId(user_id)) {
      res.status(400).json({ error: 'Invalid user_id format' });
      return;
    }

    if (!event_id) {
      res.status(400).json({ error: 'event_id is required' });
      return;
    }

    console.log('Updating event for user:', user_id);
    console.log('Event updates:', eventDataUpdate);

    const updatedEvent = await getSupabaseService().updateEvent(user_id, event_id, eventDataUpdate);
    
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
    const authUserId = req.authUserId;
    const { user_id, event_id } = req.body ?? {};

    if (!event_id) {
      sendErrorResponse(res, 400, 'event_id is required');
      return;
    }

    const resolvedUserId = authUserId ?? user_id;

    if (!resolvedUserId) {
      sendErrorResponse(res, 400, 'user_id is required');
      return;
    }

    if (!validateUserId(resolvedUserId)) {
      sendErrorResponse(res, 400, 'Invalid user_id format');
      return;
    }

    if (authUserId && user_id && authUserId !== user_id) {
      sendErrorResponse(res, 403, 'Authenticated user does not match user_id');
      return;
    }

    console.log('Deleting event for user:', resolvedUserId);

    const result = await getSupabaseService().deleteEvent(resolvedUserId, event_id);

    if (result.success) {
      res.json({
        success: true
      });
    } else {
      sendErrorResponse(res, 500, result.error || 'Failed to delete event');
    }

  } catch (error) {
    console.error('Error deleting user event:', error);
    sendErrorResponse(res, 500, 'Failed to delete user event');
  }
}

// ============================================================================
// RECURRING EVENT ENDPOINTS
// ============================================================================

export async function createRecurringEvent(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, title, start_time, recurrence_rule, recurrence_end, location, description, aspect } = req.body;

    // Validate required fields
    if (!user_id) {
      sendErrorResponse(res, 400, 'user_id is required');
      return;
    }

    if (!validateUserId(user_id)) {
      sendErrorResponse(res, 400, 'Invalid user_id format');
      return;
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      sendErrorResponse(res, 400, 'Event title is required');
      return;
    }

    if (!start_time) {
      sendErrorResponse(res, 400, 'start_time is required');
      return;
    }

    if (!recurrence_rule) {
      sendErrorResponse(res, 400, 'recurrence_rule is required (RFC 5545 format)');
      return;
    }

    logger.info('Creating recurring event for user', { user_id, title });

    const event = await getSupabaseService().createRecurringEvent(user_id, {
      title: title.trim(),
      start_time,
      end_time: req.body.end_time || new Date(new Date(start_time).getTime() + 60 * 60 * 1000).toISOString(),
      location: location || '',
      description: description || '',
      aspect: aspect || 'Personal',
      recurrence_rule,
      recurrence_end: recurrence_end || null
    });

    if (!event) {
      sendErrorResponse(res, 500, 'Failed to create recurring event');
      return;
    }

    logger.info('Successfully created recurring event', { event_id: event.id, user_id });

    res.status(201).json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error creating recurring event:', error);
    sendErrorResponse(res, 500, 'Failed to create recurring event', { error });
  }
}

export async function getExpandedEvents(req: Request, res: Response): Promise<void> {
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

    logger.info('Fetching expanded events for user', { user_id, start_date, end_date });

    const events = await getSupabaseService().getExpandedEvents(user_id, start_date, end_date);

    logger.info('Successfully fetched expanded events', { count: events.length, user_id });

    res.json({
      success: true,
      events
    });
  } catch (error) {
    logger.error('Error fetching expanded events', { error: error instanceof Error ? error.message : error });
    sendErrorResponse(res, 500, 'Failed to fetch expanded events', { error });
  }
}

export async function updateRecurringEvent(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, event_id, scope, ...updates } = req.body;

    if (!user_id) {
      sendErrorResponse(res, 400, 'user_id is required');
      return;
    }

    if (!validateUserId(user_id)) {
      sendErrorResponse(res, 400, 'Invalid user_id format');
      return;
    }

    if (!event_id) {
      sendErrorResponse(res, 400, 'event_id is required');
      return;
    }

    if (!scope || !['entire_series', 'this_instance'].includes(scope)) {
      sendErrorResponse(res, 400, 'scope must be "entire_series" or "this_instance"');
      return;
    }

    logger.info('Updating recurring event', { user_id, event_id, scope });

    if (scope === 'entire_series') {
      const event = await getSupabaseService().updateRecurringEventSeries(user_id, event_id, updates);

      if (!event) {
        sendErrorResponse(res, 500, 'Failed to update recurring series');
        return;
      }

      logger.info('Successfully updated recurring series', { event_id, user_id });

      res.json({
        success: true,
        event
      });
    } else {
      // For single instance, would need more context (which occurrence date)
      sendErrorResponse(res, 501, 'Updating single instances is not yet fully supported via API');
    }
  } catch (error) {
    console.error('Error updating recurring event:', error);
    sendErrorResponse(res, 500, 'Failed to update recurring event', { error });
  }
}

export async function deleteRecurringEvent(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, event_id, scope } = req.body;

    if (!user_id) {
      sendErrorResponse(res, 400, 'user_id is required');
      return;
    }

    if (!validateUserId(user_id)) {
      sendErrorResponse(res, 400, 'Invalid user_id format');
      return;
    }

    if (!event_id) {
      sendErrorResponse(res, 400, 'event_id is required');
      return;
    }

    if (!scope || !['entire_series', 'this_instance', 'all_future'].includes(scope)) {
      sendErrorResponse(res, 400, 'scope must be "entire_series", "this_instance", or "all_future"');
      return;
    }

    logger.info('Deleting recurring event', { user_id, event_id, scope });

    if (scope === 'entire_series') {
      const success = await getSupabaseService().deleteRecurringEventSeries(user_id, event_id);

      if (!success) {
        sendErrorResponse(res, 500, 'Failed to delete recurring series');
        return;
      }

      logger.info('Successfully deleted recurring series', { event_id, user_id });

      res.json({
        success: true
      });
    } else {
      // For other scopes, would need instance-specific handling
      sendErrorResponse(res, 501, 'Deleting specific instances is not yet fully supported via API');
    }
  } catch (error) {
    console.error('Error deleting recurring event:', error);
    sendErrorResponse(res, 500, 'Failed to delete recurring event', { error });
  }
}

/**
 * Get friends' visible events
 * POST /api/events/friends
 * Body: { user_id, start_date?, end_date? }
 */
export async function getFriendsEvents(req: Request, res: Response): Promise<void> {
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

    logger.info('Fetching friends events', { user_id, start_date, end_date });

    const events = await getSupabaseService().getFriendsEvents(user_id, start_date, end_date);

    logger.info('Successfully fetched friends events', { count: events.length, user_id });

    res.json({
      success: true,
      events: events
    });
  } catch (error) {
    logger.error('Error fetching friends events', { error: error instanceof Error ? error.message : error });
    sendErrorResponse(res, 500, 'Failed to fetch friends events', { error });
  }
}

/**
 * Toggle friend event visibility
 * POST /api/friends/:friendId/visibility
 * Body: { user_id, showEvents: boolean }
 */
export async function toggleFriendEventVisibility(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, showEvents } = req.body;
    const { friendId } = req.params;

    if (!user_id || !friendId) {
      sendErrorResponse(res, 400, 'user_id and friendId are required');
      return;
    }

    if (typeof showEvents !== 'boolean') {
      sendErrorResponse(res, 400, 'showEvents must be a boolean');
      return;
    }

    logger.info('Toggling friend event visibility', { user_id, friendId, showEvents });

    const result = await getSupabaseService().toggleFriendEventVisibility(user_id, friendId, showEvents);

    if (!result.success) {
      sendErrorResponse(res, 500, 'Failed to toggle visibility');
      return;
    }

    logger.info('Successfully toggled friend event visibility', { user_id, friendId, showEvents });

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('Error toggling visibility', { error: error instanceof Error ? error.message : error });
    sendErrorResponse(res, 500, 'Failed to toggle visibility', { error });
  }
}
