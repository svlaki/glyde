/**
 * Scribe Scheduler
 *
 * Runs scribe jobs on a schedule within the agent server process.
 * - Daily digest: every 24 hours (default 11 PM UTC)
 * - Pattern scan: every 7 days
 * - Connection finder: every 7 days (offset by 3.5 days from pattern scan)
 *
 * All jobs run server-side, independent of whether users are online.
 */

import { SupabaseService } from '../services/SupabaseService.js';
import { ScribeAgent } from '../agents/scribe/ScribeAgent.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

const DAILY_DIGEST_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const WEEKLY_INTERVAL = 7 * 24 * 60 * 60 * 1000;   // 7 days
const MIN_ACTIVITY_THRESHOLD = 1;

async function runDigestForUser(userId: string, timezone: string): Promise<void> {
  try {
    const supabase = new SupabaseService();

    // Check activity threshold
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ count: eventCount }, { count: taskCount }] = await Promise.all([
      supabase.getClient()
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('start_time', todayStart.toISOString()),
      supabase.getClient()
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('updated_at', todayStart.toISOString()),
    ]);

    if (((eventCount || 0) + (taskCount || 0)) < MIN_ACTIVITY_THRESHOLD) return;

    // Check dedup
    const todayFormatted = todayStart.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const { data: existing } = await supabase.getClient()
      .from('notes')
      .select('id')
      .eq('user_id', userId)
      .eq('title', `Daily Digest - ${todayFormatted}`)
      .eq('source', 'scribe')
      .limit(1);

    if (existing && existing.length > 0) return;

    const scribe = new ScribeAgent();
    await scribe.initialize();

    await scribe.processMessage(
      {
        userId,
        sessionId: `scribe-digest-${userId}-${Date.now()}`,
        timezone,
        conversationHistory: [],
        isInternal: true,
      },
      'DAILY_DIGEST'
    );

    console.log(`[SCRIBE-SCHEDULER] Daily digest created for ${userId}`);
  } catch (error: any) {
    console.error(`[SCRIBE-SCHEDULER] Digest error for ${userId}:`, error.message);
  }
}

async function runJobForAllUsers(mode: string): Promise<void> {
  const supabase = new SupabaseService();
  const { data: users } = await supabase.getClient()
    .from('profile')
    .select('id, timezone')
    .not('id', 'is', null);

  if (!users || users.length === 0) return;

  console.log(`[SCRIBE-SCHEDULER] Running ${mode} for ${users.length} users`);

  for (const user of users) {
    if (mode === 'DAILY_DIGEST') {
      await runDigestForUser(user.id, user.timezone || 'UTC');
    } else {
      try {
        const scribe = new ScribeAgent();
        await scribe.initialize();
        await scribe.processMessage(
          {
            userId: user.id,
            sessionId: `scribe-${mode.toLowerCase()}-${user.id}-${Date.now()}`,
            timezone: user.timezone || 'UTC',
            conversationHistory: [],
            isInternal: true,
          },
          mode
        );
        console.log(`[SCRIBE-SCHEDULER] ${mode} completed for ${user.id}`);
      } catch (error: any) {
        console.error(`[SCRIBE-SCHEDULER] ${mode} error for ${user.id}:`, error.message);
      }
    }
  }
}

export function startScribeScheduler(): void {
  console.log('[SCRIBE-SCHEDULER] Starting scribe scheduler');
  console.log(`[SCRIBE-SCHEDULER] Daily digest: every ${DAILY_DIGEST_INTERVAL / 3600000}h`);
  console.log(`[SCRIBE-SCHEDULER] Pattern scan: every ${WEEKLY_INTERVAL / 86400000}d`);
  console.log(`[SCRIBE-SCHEDULER] Connection finder: every ${WEEKLY_INTERVAL / 86400000}d`);

  // Daily digest -- run first one after 1 hour, then every 24 hours
  setTimeout(() => {
    runJobForAllUsers('DAILY_DIGEST');
    setInterval(() => runJobForAllUsers('DAILY_DIGEST'), DAILY_DIGEST_INTERVAL);
  }, 60 * 60 * 1000); // 1 hour delay

  // Pattern scan -- run first one after 2 hours, then weekly
  setTimeout(() => {
    runJobForAllUsers('PATTERN_SCAN');
    setInterval(() => runJobForAllUsers('PATTERN_SCAN'), WEEKLY_INTERVAL);
  }, 2 * 60 * 60 * 1000); // 2 hour delay

  // Connection finder -- run first one after 4 hours, then weekly
  setTimeout(() => {
    runJobForAllUsers('CONNECTION_SCAN');
    setInterval(() => runJobForAllUsers('CONNECTION_SCAN'), WEEKLY_INTERVAL);
  }, 4 * 60 * 60 * 1000); // 4 hour delay
}
