import { getSupabaseService } from '../services/SupabaseService.js';
import pushNotificationService from '../services/PushNotificationService.js';

const SCHEDULER_INTERVAL_MS = 60 * 1000; // Check every 60s
const NOTIFICATION_INTERVALS = [60, 30, 15, 5]; // minutes before
const LOOKBACK_MS = 2 * 60 * 1000; // 2-minute grace window

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

const INTERVAL_LABELS: Record<number, string> = {
  60: 'in 1 hour',
  30: 'in 30 minutes',
  15: 'in 15 minutes',
  5: 'in 5 minutes',
};

async function checkEventCountdowns(): Promise<void> {
  const client = getSupabaseService().getClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);

  const { data: events, error } = await client
    .from('events')
    .select('id, user_id, title, start_time')
    .gte('start_time', now.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .eq('is_recurring', false);

  if (error || !events || events.length === 0) return;

  for (const event of events) {
    const startTime = new Date(event.start_time).getTime();

    for (const interval of NOTIFICATION_INTERVALS) {
      const notifyAt = startTime - interval * 60 * 1000;
      const nowMs = now.getTime();

      if (notifyAt <= nowMs && notifyAt > nowMs - LOOKBACK_MS) {
        const { error: logError } = await client
          .from('push_notification_log')
          .insert({
            user_id: event.user_id,
            entity_type: 'event',
            entity_id: event.id,
            interval_minutes: interval,
          })
          .select()
          .single();

        // Unique constraint violation means already sent
        if (logError) continue;

        try {
          await pushNotificationService.sendToUser(event.user_id, {
            title: 'Upcoming Event',
            body: `${event.title} ${INTERVAL_LABELS[interval]}`,
            data: { type: 'event_countdown', eventId: event.id },
            sound: 'default',
          });
        } catch (error) {
          console.error(`[NOTIFICATION-SCHEDULER] Push failed for event ${event.id}:`, error);
        }
      }
    }
  }
}

async function checkTaskCountdowns(): Promise<void> {
  const client = getSupabaseService().getClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);

  // Fetch tasks with due_date in the near future
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

    // Check if due_date has a time component or is date-only
    const dueDateStr = task.due_date as string;
    if (dueDateStr.includes('T') && !dueDateStr.endsWith('T00:00:00.000Z')) {
      dueTime = new Date(dueDateStr).getTime();
    } else {
      // Date-only: interpret as 9:00 AM in user's timezone
      const tz = timezoneMap.get(task.user_id) || 'America/Los_Angeles';
      const dateOnly = dueDateStr.split('T')[0];
      // Create a date at 9 AM in the user's timezone
      const localDate = new Date(`${dateOnly}T09:00:00`);
      // Adjust for timezone by using Intl to find the offset
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
      // Use a reference to get the offset
      const nowInTz = formatter.format(now);
      const nowUtc = now.toISOString();
      // Simpler approach: create the date string with timezone
      try {
        const target = new Date(new Date(`${dateOnly}T09:00:00`).toLocaleString('en-US', { timeZone: tz }));
        dueTime = target.getTime();
      } catch {
        dueTime = new Date(`${dateOnly}T09:00:00Z`).getTime();
      }
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

        try {
          await pushNotificationService.sendToUser(task.user_id, {
            title: 'Task Due',
            body: `${task.title} due ${INTERVAL_LABELS[interval]}`,
            data: { type: 'task_countdown', taskId: task.id },
            sound: 'default',
          });
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
    await Promise.all([
      checkEventCountdowns(),
      checkTaskCountdowns(),
    ]);

    // Cleanup old logs every run (cheap operation with index)
    await cleanupOldLogs();
  } catch (error) {
    console.error('[NOTIFICATION-SCHEDULER] Error during scheduler run:', error);
  } finally {
    isRunning = false;
  }
}

export function startNotificationSchedulerJob(): void {
  if (schedulerInterval) return;

  console.log('[NOTIFICATION-SCHEDULER] Starting notification scheduler (interval: 60s)');

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
}

export function stopNotificationSchedulerJob(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  console.log('[NOTIFICATION-SCHEDULER] Job stopped');
}
