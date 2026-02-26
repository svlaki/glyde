import { Request, Response } from 'express';
import reminderService from '../services/ReminderService.js';

export async function getUserReminders(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, aspect_id, include_history } = req.body;

    const reminders = await reminderService.getReminders(userId, {
      status,
      aspectId: aspect_id,
      includeHistory: include_history || false,
    });

    res.json({ success: true, reminders });
  } catch (error) {
    console.error('[REMINDERS] Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
}

export async function createUserReminder(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { message, trigger_at, aspect_id, metadata } = req.body;

    if (!message || !trigger_at) {
      res.status(400).json({ error: 'message and trigger_at are required' });
      return;
    }

    const reminder = await reminderService.createReminder(userId, {
      message,
      trigger_at,
      aspect_id,
      created_by: 'user',
      metadata,
    });

    if (!reminder) {
      res.status(500).json({ error: 'Failed to create reminder' });
      return;
    }

    res.json({ success: true, reminder });
  } catch (error) {
    console.error('[REMINDERS] Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
}

export async function updateUserReminder(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { reminder_id, message, trigger_at, aspect_id } = req.body;

    if (!reminder_id) {
      res.status(400).json({ error: 'reminder_id is required' });
      return;
    }

    const updated = await reminderService.updateReminder(userId, reminder_id, {
      message,
      trigger_at,
      aspect_id,
    });

    if (!updated) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    res.json({ success: true, reminder: updated });
  } catch (error) {
    console.error('[REMINDERS] Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
}

export async function deleteUserReminder(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { reminder_id } = req.body;

    if (!reminder_id) {
      res.status(400).json({ error: 'reminder_id is required' });
      return;
    }

    const result = await reminderService.deleteReminder(userId, reminder_id);

    if (!result.success) {
      res.status(404).json({ error: result.error || 'Reminder not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[REMINDERS] Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
}

export async function dismissEventReminders(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { event_id } = req.body;

    if (!event_id) {
      res.status(400).json({ error: 'event_id is required' });
      return;
    }

    await reminderService.dismissEventReminders(userId, event_id);
    res.json({ success: true });
  } catch (error) {
    console.error('[REMINDERS] Error dismissing event reminders:', error);
    res.status(500).json({ error: 'Failed to dismiss event reminders' });
  }
}

export async function snoozeUserReminder(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { reminder_id, snooze_minutes } = req.body;

    if (!reminder_id || typeof snooze_minutes !== 'number' || snooze_minutes <= 0) {
      res.status(400).json({ error: 'reminder_id and snooze_minutes (positive number) are required' });
      return;
    }

    const snoozeUntil = new Date(Date.now() + snooze_minutes * 60000).toISOString();
    const success = await reminderService.snoozeReminder(userId, reminder_id, snoozeUntil);

    if (!success) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    res.json({ success: true, snooze_until: snoozeUntil });
  } catch (error) {
    console.error('[REMINDERS] Error snoozing reminder:', error);
    res.status(500).json({ error: 'Failed to snooze reminder' });
  }
}
