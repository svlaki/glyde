/**
 * Scribe Scheduler
 *
 * Checks every 15 minutes which users have reached 3 AM local time
 * and runs the daily digest for yesterday. This means each user gets
 * their digest at 3 AM in their own timezone, not a single global time.
 *
 * Pattern scan and connection finder run weekly (Sunday 4 AM local).
 *
 * All jobs run server-side, independent of whether users are online.
 */

import { SupabaseService } from '../services/SupabaseService.js';
import { ScribeAgent } from '../agents/scribe/ScribeAgent.js';

const CHECK_INTERVAL = 15 * 60 * 1000; // Check every 15 minutes
const DIGEST_HOUR = 3;                  // 3 AM local time
const WEEKLY_DAY = 0;                   // Sunday
const WEEKLY_HOUR = 4;                  // 4 AM local time
const MIN_ACTIVITY_THRESHOLD = 1;

/**
 * Get the current hour in a user's timezone
 */
function getLocalHour(timezone: string): number {
  try {
    const hourStr = new Date().toLocaleString('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(hourStr, 10);
  } catch {
    return -1; // Invalid timezone
  }
}

/**
 * Get the current day of week (0=Sunday) in a user's timezone
 */
function getLocalDayOfWeek(timezone: string): number {
  try {
    const dayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: timezone,
    });
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[dayStr] ?? -1;
  } catch {
    return -1;
  }
}

/**
 * Get yesterday's date string in the user's timezone (for digest title)
 */
function getYesterdayFormatted(timezone: string): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
}

async function runDigestForUser(userId: string, timezone: string): Promise<void> {
  try {
    const supabase = new SupabaseService();
    const yesterdayTitle = `Daily Digest - ${getYesterdayFormatted(timezone)}`;

    // Dedup: check if this digest already exists
    const { data: existing } = await supabase.getClient()
      .from('notes')
      .select('id')
      .eq('user_id', userId)
      .eq('title', yesterdayTitle)
      .eq('source', 'scribe')
      .limit(1);

    if (existing && existing.length > 0) return;

    // Check yesterday's activity
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ydayStr = yesterday.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    const ydayStart = new Date(`${ydayStr}T00:00:00`).toISOString();
    const ydayEnd = new Date(`${ydayStr}T23:59:59`).toISOString();

    const [{ count: eventCount }, { count: taskCount }] = await Promise.all([
      supabase.getClient()
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('start_time', ydayStart)
        .lte('start_time', ydayEnd),
      supabase.getClient()
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('updated_at', ydayStart)
        .lte('updated_at', ydayEnd),
    ]);

    if (((eventCount || 0) + (taskCount || 0)) < MIN_ACTIVITY_THRESHOLD) return;

    // Find the most recent existing digest to link to
    const { data: prevDigest } = await supabase.getClient()
      .from('notes')
      .select('id, title')
      .eq('user_id', userId)
      .eq('source', 'scribe')
      .like('title', 'Daily Digest%')
      .order('created_at', { ascending: false })
      .limit(1);

    const prevDigestTitle = prevDigest?.[0]?.title || null;

    const scribe = new ScribeAgent();
    await scribe.initialize();

    // Pass the previous digest title so the Scribe can wiki-link to it
    const message = prevDigestTitle
      ? `DAILY_DIGEST\nPREVIOUS_DIGEST_TITLE: ${prevDigestTitle}`
      : 'DAILY_DIGEST';

    await scribe.processMessage(
      {
        userId,
        sessionId: `scribe-digest-${userId}-${Date.now()}`,
        timezone,
        conversationHistory: [],
        isInternal: true,
      },
      message
    );

    console.log(`[SCRIBE-SCHEDULER] Digest created for ${userId}: ${yesterdayTitle}`);
  } catch (error: any) {
    console.error(`[SCRIBE-SCHEDULER] Digest error for ${userId}:`, error.message);
  }
}

async function runWeeklyJob(mode: string, userId: string, timezone: string): Promise<void> {
  try {
    const scribe = new ScribeAgent();
    await scribe.initialize();
    await scribe.processMessage(
      {
        userId,
        sessionId: `scribe-${mode.toLowerCase()}-${userId}-${Date.now()}`,
        timezone,
        conversationHistory: [],
        isInternal: true,
      },
      mode
    );
    console.log(`[SCRIBE-SCHEDULER] ${mode} completed for ${userId}`);
  } catch (error: any) {
    console.error(`[SCRIBE-SCHEDULER] ${mode} error for ${userId}:`, error.message);
  }
}

// Track which users have already been processed this hour to avoid re-runs
const processedDigests = new Set<string>(); // "userId-YYYY-MM-DD"
const processedWeekly = new Set<string>();  // "userId-mode-weekNum"

async function checkAndRunJobs(): Promise<void> {
  const supabase = new SupabaseService();
  const { data: users } = await supabase.getClient()
    .from('profile')
    .select('id, timezone')
    .not('id', 'is', null);

  if (!users || users.length === 0) return;

  for (const user of users) {
    const tz = user.timezone || 'UTC';
    const localHour = getLocalHour(tz);
    const localDay = getLocalDayOfWeek(tz);

    // Daily digest: run at 3 AM local time
    if (localHour === DIGEST_HOUR) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const key = `${user.id}-${yesterday.toLocaleDateString('en-CA', { timeZone: tz })}`;
      if (!processedDigests.has(key)) {
        processedDigests.add(key);
        await runDigestForUser(user.id, tz);
      }
    }

    // Weekly jobs: Sunday 4 AM local time
    if (localDay === WEEKLY_DAY && localHour === WEEKLY_HOUR) {
      const weekKey = `${user.id}-${new Date().toISOString().slice(0, 10)}`;

      if (!processedWeekly.has(`${weekKey}-patterns`)) {
        processedWeekly.add(`${weekKey}-patterns`);
        await runWeeklyJob('PATTERN_SCAN', user.id, tz);
      }
      if (!processedWeekly.has(`${weekKey}-connections`)) {
        processedWeekly.add(`${weekKey}-connections`);
        await runWeeklyJob('CONNECTION_SCAN', user.id, tz);
      }
    }
  }

  // Clean old entries from dedup sets (keep last 48 hours worth)
  if (processedDigests.size > 200) {
    processedDigests.clear();
  }
  if (processedWeekly.size > 100) {
    processedWeekly.clear();
  }
}

export function startScribeScheduler(): void {
  console.log('[SCRIBE-SCHEDULER] Starting scribe scheduler');
  console.log(`[SCRIBE-SCHEDULER] Digest: 3 AM user local time (checks every 15min)`);
  console.log(`[SCRIBE-SCHEDULER] Weekly jobs: Sunday 4 AM user local time`);

  // Check every 15 minutes
  setInterval(() => {
    checkAndRunJobs().catch(err =>
      console.error('[SCRIBE-SCHEDULER] Error in check cycle:', err.message)
    );
  }, CHECK_INTERVAL);

  // Also run an initial check 2 minutes after startup
  setTimeout(() => {
    checkAndRunJobs().catch(err =>
      console.error('[SCRIBE-SCHEDULER] Error in initial check:', err.message)
    );
  }, 2 * 60 * 1000);
}
