import reminderService from '../services/ReminderService.js';
import { getSupabaseService } from '../services/SupabaseService.js';
import { expandRecurrence } from '../utils/rrule.js';
import pushNotificationService from '../services/PushNotificationService.js';

const DELIVERY_INTERVAL_MS = 60 * 1000; // Check for due reminders every 60s
const RECURRING_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // Top up recurring reminders every 6 hours
let deliveryInterval: NodeJS.Timeout | null = null;
let recurringSyncInterval: NodeJS.Timeout | null = null;
let isDelivering = false;

/**
 * Check for due reminders and deliver them as interaction cards.
 * Runs every 60s - lightweight, just checks trigger_at <= now.
 */
export async function deliverDueReminders(): Promise<void> {
  if (isDelivering) return;
  isDelivering = true;
  try {
    const supabaseService = getSupabaseService();
    const dueReminders = await reminderService.getDueReminders();

    if (dueReminders.length === 0) return;

    console.log(`[REMINDER-CHECKER] Found ${dueReminders.length} due reminder(s)`);

    for (const reminder of dueReminders) {
      try {
        const metadata = (reminder.metadata || {}) as Record<string, any>;
        const isEventReminder = !!metadata.event_reminder_id;

        // Deliver reminders via push notification only — NOT as interaction cards.
        // Interaction cards clutter the panel with "Got it/Snooze" noise.
        // Reminders belong as toast notifications and are shown on the Reminders page.
        try {
          await pushNotificationService.sendToUser(reminder.user_id, {
            title: isEventReminder ? 'Upcoming Event' : 'Reminder',
            body: reminder.message,
            data: { type: 'reminder', reminderId: reminder.id },
            sound: 'default',
          });
        } catch (pushError) {
          console.error(`[REMINDER-CHECKER] Push failed for ${reminder.id}:`, pushError);
        }

        // Mark as delivered (no interaction card ID needed)
        await reminderService.markDelivered(reminder.user_id, reminder.id);
        console.log(`[REMINDER-CHECKER] Delivered reminder ${reminder.id} via push notification`);
      } catch (error) {
        console.error(`[REMINDER-CHECKER] Failed to deliver reminder ${reminder.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[REMINDER-CHECKER] Error during delivery check:', error);
  } finally {
    isDelivering = false;
  }
}

/**
 * Sync reminders for a single recurring event's upcoming instances.
 * Called immediately when reminder_minutes is set on a recurring event,
 * and periodically by the background job to top up the rolling window.
 */
export async function syncRecurringEventInstanceReminders(
  userId: string,
  eventId: string,
  eventTitle: string,
  eventStartTime: string,
  recurrenceRule: string,
  reminderMinutes: number,
  aspectId?: string,
  timezone?: string
): Promise<void> {
  try {
    const tz = timezone || 'America/Los_Angeles';
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eventStart = new Date(eventStartTime);

    const instances = expandRecurrence(
      recurrenceRule,
      eventStart,
      weekFromNow,
      50,
      tz
    );

    const futureInstances = instances.filter(d => d > now);

    for (const instanceStart of futureInstances) {
      const instanceDate = instanceStart.toISOString().split('T')[0];
      await reminderService.syncEventReminder(
        userId, eventId, eventTitle, instanceStart.toISOString(),
        reminderMinutes, aspectId, instanceDate
      );
    }
  } catch (error) {
    console.error(`[REMINDER-CHECKER] Error syncing recurring reminders for "${eventTitle}":`, error);
  }
}

/**
 * Top up recurring event reminders for all users.
 * Runs every 6 hours to ensure the next 7 days always have reminders queued.
 */
async function topUpRecurringReminders(): Promise<void> {
  try {
    const supabaseService = getSupabaseService();
    const { data: recurringEvents, error } = await supabaseService.getClient()
      .from('events')
      .select('id, user_id, title, start_time, reminder_minutes, aspect_id, recurrence_rule')
      .eq('is_recurring', true)
      .is('parent_event_id', null)
      .not('reminder_minutes', 'is', null)
      .not('recurrence_rule', 'is', null);

    if (error || !recurringEvents || recurringEvents.length === 0) return;

    // Batch-fetch timezones
    const userIds = [...new Set(recurringEvents.map(e => e.user_id))];
    const timezoneMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseService.getClient()
        .from('profile')
        .select('id, timezone')
        .in('id', userIds);

      for (const p of (profiles || [])) {
        timezoneMap.set(p.id, p.timezone || 'America/Los_Angeles');
      }
    }

    for (const event of recurringEvents) {
      await syncRecurringEventInstanceReminders(
        event.user_id, event.id, event.title, event.start_time,
        event.recurrence_rule, event.reminder_minutes,
        event.aspect_id || undefined,
        timezoneMap.get(event.user_id)
      );
    }

    console.log(`[REMINDER-CHECKER] Topped up recurring reminders for ${recurringEvents.length} event(s)`);
  } catch (error) {
    console.error('[REMINDER-CHECKER] Error topping up recurring reminders:', error);
  }
}

export function startReminderCheckerJob(): void {
  if (deliveryInterval) return;

  console.log('[REMINDER-CHECKER] Starting reminder checker (delivery: 60s, recurring sync: 6h)');

  // Delivery check every 60s
  deliverDueReminders().catch(err => {
    console.error('[REMINDER-CHECKER] Initial delivery check failed:', err);
  });

  deliveryInterval = setInterval(() => {
    deliverDueReminders().catch(err => {
      console.error('[REMINDER-CHECKER] Delivery check failed:', err);
    });
  }, DELIVERY_INTERVAL_MS);

  // Recurring sync every 6 hours (initial run after 5 minutes to not slow startup)
  setTimeout(() => {
    topUpRecurringReminders().catch(err => {
      console.error('[REMINDER-CHECKER] Initial recurring sync failed:', err);
    });

    recurringSyncInterval = setInterval(() => {
      topUpRecurringReminders().catch(err => {
        console.error('[REMINDER-CHECKER] Recurring sync failed:', err);
      });
    }, RECURRING_SYNC_INTERVAL_MS);
  }, 5 * 60 * 1000);
}

export function stopReminderCheckerJob(): void {
  if (deliveryInterval) {
    clearInterval(deliveryInterval);
    deliveryInterval = null;
  }
  if (recurringSyncInterval) {
    clearInterval(recurringSyncInterval);
    recurringSyncInterval = null;
  }
  console.log('[REMINDER-CHECKER] Job stopped');
}
