import { Request, Response } from 'express';
import { SupabaseService } from '../services/SupabaseService.js';
import { logger } from '../utils/logger.js';
import reminderService from '../services/ReminderService.js';
import { syncRecurringEventInstanceReminders } from '../jobs/reminder-checker.js';

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
    const { user_id, start_date, end_date, raw } = req.body;

    if (!user_id) {
      sendErrorResponse(res, 400, 'user_id is required');
      return;
    }

    if (!validateUserId(user_id)) {
      sendErrorResponse(res, 400, 'Invalid user_id format');
      return;
    }

    logger.info('Fetching events for user', { user_id, start_date, end_date, raw });

    // When raw=true, return parent events only (no recurring expansion) - useful for counts/profile
    const events = raw
      ? await getSupabaseService().getRawEvents(user_id, start_date, end_date)
      : await getSupabaseService().getEvents(user_id, start_date, end_date);
    
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

    logger.info('Creating event for user', { user_id });

    const createdEvent = await getSupabaseService().createEvent(user_id, {
      ...eventData,
      title: eventData.title.trim()
    });
    
    if (createdEvent) {
      // Sync reminder if reminder_minutes was set
      if (eventData.reminder_minutes != null) {
        await reminderService.syncEventReminder(
          user_id, createdEvent.id, createdEvent.title, createdEvent.start_time,
          eventData.reminder_minutes, createdEvent.aspect_id || undefined
        );
      }

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
    logger.error('Error creating user event', { error: error instanceof Error ? error.message : String(error) });
    
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

    logger.info('Updating event for user', { user_id, event_id });

    const updatedEvent = await getSupabaseService().updateEvent(user_id, event_id, eventDataUpdate);
    
    if (updatedEvent) {
      // Sync reminder if reminder_minutes changed, or if event time changed and event has a reminder
      if (eventDataUpdate.reminder_minutes !== undefined) {
        await reminderService.syncEventReminder(
          user_id, updatedEvent.id, updatedEvent.title, updatedEvent.start_time,
          eventDataUpdate.reminder_minutes, updatedEvent.aspect_id || undefined
        );
      } else if (
        (eventDataUpdate.start_time || eventDataUpdate.end_time) &&
        updatedEvent.reminder_minutes != null
      ) {
        // Event time changed but reminder setting didn't - resync with existing reminder_minutes
        await reminderService.syncEventReminder(
          user_id, updatedEvent.id, updatedEvent.title, updatedEvent.start_time,
          updatedEvent.reminder_minutes, updatedEvent.aspect_id || undefined
        );
      }

      res.json({
        success: true,
        event: updatedEvent
      });
    } else {
      res.status(500).json({ error: 'Failed to update event' });
    }

  } catch (error) {
    logger.error('Error updating user event', { error: error instanceof Error ? error.message : String(error) });
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

    logger.info('Deleting event for user', { user_id: resolvedUserId, event_id });

    const result = await getSupabaseService().deleteEvent(resolvedUserId, event_id);

    if (result.success) {
      res.json({
        success: true
      });
    } else {
      sendErrorResponse(res, 500, result.error || 'Failed to delete event');
    }

  } catch (error) {
    logger.error('Error deleting user event', { error: error instanceof Error ? error.message : String(error) });
    sendErrorResponse(res, 500, 'Failed to delete user event');
  }
}

// ============================================================================
// RECURRING EVENT ENDPOINTS
// ============================================================================

export async function createRecurringEvent(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, title, start_time, recurrence_rule, recurrence_end, location, description, aspect, reminder_minutes } = req.body;

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
      recurrence_end: recurrence_end || null,
      reminder_minutes: reminder_minutes ?? null
    });

    if (!event) {
      sendErrorResponse(res, 500, 'Failed to create recurring event');
      return;
    }

    logger.info('Successfully created recurring event', { event_id: event.id, user_id });

    // Immediately create reminders for upcoming instances
    if (reminder_minutes != null && recurrence_rule) {
      const { data: profile } = await getSupabaseService().getClient()
        .from('profile').select('timezone').eq('id', user_id).single();
      const tz = profile?.timezone || 'America/Los_Angeles';

      syncRecurringEventInstanceReminders(
        user_id, event.id, event.title, event.start_time,
        recurrence_rule, reminder_minutes, event.aspect_id || undefined, tz
      ).catch(err => console.error('[EVENTS] Failed to sync recurring reminders:', err));
    }

    res.status(201).json({
      success: true,
      event
    });
  } catch (error) {
    logger.error('Error creating recurring event', { error: error instanceof Error ? error.message : String(error) });
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

      // Sync reminders if reminder_minutes changed on the series
      if (updates.reminder_minutes !== undefined && event.recurrence_rule) {
        if (updates.reminder_minutes == null) {
          // Reminder removed - dismiss all pending event reminders
          await reminderService.dismissEventReminders(user_id, event_id);
        } else {
          const { data: profile } = await getSupabaseService().getClient()
            .from('profile').select('timezone').eq('id', user_id).single();
          const tz = profile?.timezone || 'America/Los_Angeles';

          // Dismiss old, then create new for upcoming instances
          await reminderService.dismissEventReminders(user_id, event_id);
          syncRecurringEventInstanceReminders(
            user_id, event_id, event.title, event.start_time,
            event.recurrence_rule, updates.reminder_minutes,
            event.aspect_id || undefined, tz
          ).catch(err => console.error('[EVENTS] Failed to sync recurring reminders:', err));
        }
      }

      res.json({
        success: true,
        event
      });
    } else {
      // Single instance update using exception catalogue
      const { instance_date, ...instanceUpdates } = updates;

      if (!instance_date) {
        sendErrorResponse(res, 400, 'instance_date is required for this_instance scope');
        return;
      }

      const event = await getSupabaseService().updateRecurringEventInstance(
        user_id,
        event_id,
        instance_date,
        instanceUpdates
      );

      if (!event) {
        sendErrorResponse(res, 500, 'Failed to update recurring event instance');
        return;
      }

      logger.info('Successfully updated recurring instance', { event_id, instance_date, user_id });

      res.json({
        success: true,
        event
      });
    }
  } catch (error) {
    logger.error('Error updating recurring event', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('Error deleting recurring event', { error: error instanceof Error ? error.message : String(error) });
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
