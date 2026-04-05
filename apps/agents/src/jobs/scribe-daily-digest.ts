/**
 * Scribe Daily Digest Job
 *
 * Runs nightly for each active user, creating a daily digest note
 * summarizing the day's events, tasks, goals, and chat activity.
 *
 * Notes are created with source='scribe' and status='scribe',
 * visible in the knowledge graph but not the notes dropdown.
 *
 * Recommended frequency: Daily at 11 PM user's local time (or 3 AM UTC as fallback)
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/scribe-daily-digest.ts
 */

import 'dotenv/config';
import { SupabaseService, initializeSupabase } from '../services/SupabaseService.js';
import { ScribeAgent } from '../agents/scribe/ScribeAgent.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

const MAX_CONCURRENT_USERS = 3;
const MIN_ACTIVITY_THRESHOLD = 1; // Minimum events+tasks to justify a digest

interface DigestResult {
  userId: string;
  success: boolean;
  error?: string;
}

async function runDailyDigest(): Promise<void> {
  console.log('================================================================');
  console.log('[SCRIBE-DIGEST] Starting daily digest job...');
  console.log(`[SCRIBE-DIGEST] Max concurrent: ${MAX_CONCURRENT_USERS}`);
  console.log('================================================================');

  initializeSupabase();
  const supabase = new SupabaseService();

  // Ensure ToolRegistry is populated (needed by ScribeAgent)
  ToolRegistry.getInstance();

  // Get all active users
  const { data: users, error: userError } = await supabase.getClient()
    .from('profile')
    .select('id, timezone, display_name, email')
    .not('id', 'is', null);

  if (userError || !users || users.length === 0) {
    console.log('[SCRIBE-DIGEST] No users found or error:', userError?.message);
    return;
  }

  console.log(`[SCRIBE-DIGEST] Processing ${users.length} users...`);

  const results: DigestResult[] = [];

  // Process in batches
  for (let i = 0; i < users.length; i += MAX_CONCURRENT_USERS) {
    const batch = users.slice(i, i + MAX_CONCURRENT_USERS);

    const batchResults = await Promise.allSettled(
      batch.map(async (user) => {
        try {
          // Check if user had activity today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const [{ count: eventCount }, { count: taskCount }] = await Promise.all([
            supabase.getClient()
              .from('events')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('start_time', todayStart.toISOString()),
            supabase.getClient()
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('updated_at', todayStart.toISOString()),
          ]);

          const totalActivity = (eventCount || 0) + (taskCount || 0);
          if (totalActivity < MIN_ACTIVITY_THRESHOLD) {
            console.log(`[SCRIBE-DIGEST] Skipping user ${user.id} (${totalActivity} activities, below threshold)`);
            return { userId: user.id, success: true };
          }

          // Check if digest already exists for today
          const todayFormatted = todayStart.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const digestTitle = `Daily Digest - ${todayFormatted}`;

          const { data: existing } = await supabase.getClient()
            .from('notes')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', digestTitle)
            .eq('source', 'scribe')
            .limit(1);

          if (existing && existing.length > 0) {
            console.log(`[SCRIBE-DIGEST] Digest already exists for user ${user.id}`);
            return { userId: user.id, success: true };
          }

          // Run the Scribe agent
          const scribe = new ScribeAgent();
          await scribe.initialize();

          const response = await scribe.processMessage(
            {
              userId: user.id,
              sessionId: `scribe-digest-${user.id}-${Date.now()}`,
              timezone: user.timezone || 'UTC',
              conversationHistory: [],
              isInternal: true,
            },
            'DAILY_DIGEST'
          );

          console.log(`[SCRIBE-DIGEST] Completed for user ${user.id}: ${response.content.slice(0, 100)}...`);
          return { userId: user.id, success: true };
        } catch (error: any) {
          console.error(`[SCRIBE-DIGEST] Error for user ${user.id}:`, error.message);
          return { userId: user.id, success: false, error: error.message };
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({ userId: 'unknown', success: false, error: result.reason?.message });
      }
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('================================================================');
  console.log(`[SCRIBE-DIGEST] Complete: ${successful} succeeded, ${failed} failed`);
  console.log('================================================================');
}

// Run if executed directly
runDailyDigest().catch(console.error);
