import { getSupabaseService } from '../services/SupabaseService.js';
import pushNotificationService from '../services/PushNotificationService.js';
import webPushService from '../services/WebPushService.js';
import { fromZonedTime } from 'date-fns-tz';

const SCHEDULER_INTERVAL_MS = 60 * 1000; // Check every 60s
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Cleanup every 6 hours
const NOTIFICATION_INTERVALS = [60, 30, 15, 5]; // minutes before
const LOOKBACK_MS = 2 * 60 * 1000; // 2-minute grace window

let schedulerInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let isRunning = false;

const INTERVAL_LABELS: Record<number, string> = {
  60: 'in 1 hour',
  30: 'in 30 minutes',
  15: 'in 15 minutes',
  5: 'in 5 minutes',
};

// Event countdowns removed — events are handled by reminder-checker.ts
// via the reminders table + reminder_minutes column.
// This scheduler now only handles task countdowns.

async function checkTaskCountdowns(): Promise<void> {
  const client = getSupabaseService().getClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);

  const { data: tasks, error } = await client
    .from('tasks')
    .select('id, user_id, title, due_date')
    .gte('due_date', now.toISOString())
    .lte('due_date', windowEnd.toISOString())
    .eq('completed', false);

  if (error || !tasks || tasks.length === 0) return;

  // Batch-fetch user timezones for date-only due_dates
  const userIds = [...new Set(tasks.map(t => t.user_id))];
  const timezoneMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await client
      .from('profile')
      .select('id, timezone')
      .in('id', userIds);

    for (const p of (profiles || [])) {
      timezoneMap.set(p.id, p.timezone || 'America/Los_Angeles');
    }
  }

  for (const task of tasks) {
    let dueTime: number;

    const dueDateStr = task.due_date as string;
    if (dueDateStr.includes('T') && !dueDateStr.endsWith('T00:00:00.000Z')) {
      // Has explicit time component — use as-is
      dueTime = new Date(dueDateStr).getTime();
    } else {
      // Date-only: interpret as 9:00 AM in user's timezone
      const tz = timezoneMap.get(task.user_id) || 'America/Los_Angeles';
      const dateOnly = dueDateStr.split('T')[0];
      dueTime = fromZonedTime(`${dateOnly}T09:00:00`, tz).getTime();
    }

    for (const interval of NOTIFICATION_INTERVALS) {
      const notifyAt = dueTime - interval * 60 * 1000;
      const nowMs = now.getTime();

      if (notifyAt <= nowMs && notifyAt > nowMs - LOOKBACK_MS) {
        const { error: logError } = await client
          .from('push_notification_log')
          .insert({
            user_id: task.user_id,
            entity_type: 'task',
            entity_id: task.id,
            interval_minutes: interval,
          })
          .select()
          .single();

        if (logError) continue;

        const payload = {
          title: 'Task Due',
          body: `${task.title} due ${INTERVAL_LABELS[interval]}`,
          data: { type: 'task_countdown', taskId: task.id },
          sound: 'default' as const,
        };

        try {
          const results = await Promise.allSettled([
            pushNotificationService.sendToUser(task.user_id, payload),
            webPushService.sendToUser(task.user_id, payload),
          ]);
          for (const result of results) {
            if (result.status === 'rejected') {
              console.error(`[NOTIFICATION-SCHEDULER] Push delivery failed for task ${task.id}:`, result.reason);
            }
          }
        } catch (error) {
          console.error(`[NOTIFICATION-SCHEDULER] Push failed for task ${task.id}:`, error);
        }
      }
    }
  }
}

async function cleanupOldLogs(): Promise<void> {
  const client = getSupabaseService().getClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  await client
    .from('push_notification_log')
    .delete()
    .lt('sent_at', cutoff);
}

async function runScheduler(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    await checkTaskCountdowns();
  } catch (error) {
    console.error('[NOTIFICATION-SCHEDULER] Error during scheduler run:', error);
  } finally {
    isRunning = false;
  }
}

export function startNotificationSchedulerJob(): void {
  if (schedulerInterval) return;

  console.log('[NOTIFICATION-SCHEDULER] Starting task notification scheduler (interval: 60s, cleanup: 6h)');

  // Initial run after a short delay to not slow startup
  setTimeout(() => {
    runScheduler().catch(err => {
      console.error('[NOTIFICATION-SCHEDULER] Initial run failed:', err);
    });
  }, 10_000);

  schedulerInterval = setInterval(() => {
    runScheduler().catch(err => {
      console.error('[NOTIFICATION-SCHEDULER] Scheduler run failed:', err);
    });
  }, SCHEDULER_INTERVAL_MS);

  // Cleanup old logs every 6 hours (initial run after 10 minutes)
  setTimeout(() => {
    cleanupOldLogs().catch(err => {
      console.error('[NOTIFICATION-SCHEDULER] Initial cleanup failed:', err);
    });

    cleanupInterval = setInterval(() => {
      cleanupOldLogs().catch(err => {
        console.error('[NOTIFICATION-SCHEDULER] Cleanup failed:', err);
      });
    }, CLEANUP_INTERVAL_MS);
  }, 10 * 60 * 1000);
}

export function stopNotificationSchedulerJob(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  console.log('[NOTIFICATION-SCHEDULER] Job stopped');
}
