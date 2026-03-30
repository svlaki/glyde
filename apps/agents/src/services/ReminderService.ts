import { getSupabaseClient } from './SupabaseService.js';

export interface Reminder {
  id: string;
  user_id: string;
  message: string;
  trigger_at: string;
  status: 'pending' | 'delivered' | 'snoozed' | 'dismissed';
  aspect_id?: string;
  created_by: 'conversation' | 'interaction' | 'user';
  metadata: Record<string, any>;
  delivered_at?: string;
  interaction_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderInput {
  message: string;
  trigger_at: string;
  aspect_id?: string;
  created_by?: 'conversation' | 'interaction' | 'user';
  metadata?: Record<string, any>;
}

export interface UpdateReminderInput {
  message?: string;
  trigger_at?: string;
  status?: 'pending' | 'delivered' | 'snoozed' | 'dismissed';
  aspect_id?: string;
  metadata?: Record<string, any>;
}

export class ReminderService {
  private client;

  constructor() {
    this.client = getSupabaseClient();
  }

  async createReminder(userId: string, input: CreateReminderInput): Promise<Reminder | null> {
    try {
      const { data, error } = await this.client
        .from('reminders')
        .insert({
          user_id: userId,
          message: input.message,
          trigger_at: input.trigger_at,
          aspect_id: input.aspect_id || null,
          created_by: input.created_by || 'conversation',
          metadata: input.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[ReminderService] Error creating reminder:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[ReminderService] Exception creating reminder:', error);
      return null;
    }
  }

  async updateReminder(userId: string, reminderId: string, updates: UpdateReminderInput): Promise<Reminder | null> {
    try {
      const updateData: Record<string, any> = {};
      if (updates.message !== undefined) updateData.message = updates.message;
      if (updates.trigger_at !== undefined) updateData.trigger_at = updates.trigger_at;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.aspect_id !== undefined) updateData.aspect_id = updates.aspect_id;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      const { data, error } = await this.client
        .from('reminders')
        .update(updateData)
        .eq('id', reminderId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('[ReminderService] Error updating reminder:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[ReminderService] Exception updating reminder:', error);
      return null;
    }
  }

  async deleteReminder(userId: string, reminderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client
        .from('reminders')
        .update({ status: 'dismissed' })
        .eq('id', reminderId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getReminders(
    userId: string,
    filters?: { status?: string; aspectId?: string; includeHistory?: boolean }
  ): Promise<Reminder[]> {
    try {
      let query = this.client
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .order('trigger_at', { ascending: true });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      } else if (!filters?.includeHistory) {
        query = query.in('status', ['pending', 'snoozed']);
      }

      if (filters?.aspectId) {
        query = query.eq('aspect_id', filters.aspectId);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('[ReminderService] Error fetching reminders:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[ReminderService] Exception fetching reminders:', error);
      return [];
    }
  }

  async getReminderById(userId: string, reminderId: string): Promise<Reminder | null> {
    try {
      const { data, error } = await this.client
        .from('reminders')
        .select('*')
        .eq('id', reminderId)
        .eq('user_id', userId)
        .single();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  }

  async getDueReminders(): Promise<Reminder[]> {
    try {
      const { data, error } = await this.client.rpc('get_due_reminders');

      if (error) {
        console.error('[ReminderService] Error fetching due reminders:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[ReminderService] Exception fetching due reminders:', error);
      return [];
    }
  }

  async markDelivered(userId: string, reminderId: string, interactionId?: string): Promise<boolean> {
    try {
      const updatePayload: Record<string, any> = {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      };
      if (interactionId) {
        updatePayload.interaction_id = interactionId;
      }
      const { error } = await this.client
        .from('reminders')
        .update(updatePayload)
        .eq('id', reminderId)
        .eq('user_id', userId)
        .in('status', ['pending', 'snoozed']);

      return !error;
    } catch {
      return false;
    }
  }

  async snoozeReminder(userId: string, reminderId: string, snoozeUntil: string): Promise<boolean> {
    try {
      const existing = await this.getReminderById(userId, reminderId);
      const snoozeCount = (existing?.metadata?.snooze_count || 0) + 1;

      const { error } = await this.client
        .from('reminders')
        .update({
          status: 'snoozed',
          trigger_at: snoozeUntil,
          metadata: {
            ...(existing?.metadata || {}),
            snooze_count: snoozeCount,
            snooze_until: snoozeUntil,
          },
        })
        .eq('id', reminderId)
        .eq('user_id', userId);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Sync a reminder for an event. Creates, updates, or dismisses a reminder
   * based on the event's reminder_minutes setting.
   * For recurring events, pass instanceDate to create per-instance reminders.
   */
  async syncEventReminder(
    userId: string,
    eventId: string,
    eventTitle: string,
    eventStartTime: string,
    reminderMinutes: number | null | undefined,
    aspectId?: string,
    instanceDate?: string
  ): Promise<void> {
    try {
      if (reminderMinutes == null) {
        // Remove any existing reminder for this event
        const existing = await this.findEventReminder(userId, eventId, instanceDate);
        if (existing && (existing.status === 'pending' || existing.status === 'snoozed')) {
          await this.client
            .from('reminders')
            .update({ status: 'dismissed' })
            .eq('id', existing.id)
            .eq('user_id', userId);
        }
        return;
      }

      const triggerAt = new Date(
        new Date(eventStartTime).getTime() - reminderMinutes * 60000
      ).toISOString();

      // Don't create reminders for times already past
      if (new Date(triggerAt) < new Date()) {
        return;
      }

      const existing = await this.findEventReminder(userId, eventId, instanceDate);

      if (existing) {
        // Update existing if still pending/snoozed
        if (existing.status === 'pending' || existing.status === 'snoozed') {
          await this.client
            .from('reminders')
            .update({
              trigger_at: triggerAt,
              message: eventTitle,
              aspect_id: aspectId || null,
            })
            .eq('id', existing.id)
            .eq('user_id', userId);
        }
      } else {
        // Create new
        await this.createReminder(userId, {
          message: eventTitle,
          trigger_at: triggerAt,
          aspect_id: aspectId,
          created_by: 'conversation',
          metadata: {
            event_reminder_id: eventId,
            ...(instanceDate ? { instance_date: instanceDate } : {}),
          },
        });
      }
    } catch (error) {
      console.error('[ReminderService] Error syncing event reminder:', error);
    }
  }

  /**
   * Find an existing reminder linked to a specific event (and optionally a specific instance).
   */
  private async findEventReminder(
    userId: string,
    eventId: string,
    instanceDate?: string
  ): Promise<Reminder | null> {
    try {
      let query = this.client
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .eq('metadata->>event_reminder_id', eventId)
        .in('status', ['pending', 'snoozed', 'delivered']);

      if (instanceDate) {
        query = query.eq('metadata->>instance_date', instanceDate);
      } else {
        query = query.is('metadata->>instance_date', null);
      }

      const { data } = await query.limit(1).maybeSingle();
      return data || null;
    } catch {
      return null;
    }
  }

  /**
   * Dismiss all pending event reminders for a given event (used when event is deleted).
   */
  async dismissEventReminders(userId: string, eventId: string): Promise<void> {
    try {
      await this.client
        .from('reminders')
        .update({ status: 'dismissed' })
        .eq('user_id', userId)
        .eq('metadata->>event_reminder_id', eventId)
        .in('status', ['pending', 'snoozed']);
    } catch (error) {
      console.error('[ReminderService] Error dismissing event reminders:', error);
    }
  }
}

const reminderService = new ReminderService();
export default reminderService;
