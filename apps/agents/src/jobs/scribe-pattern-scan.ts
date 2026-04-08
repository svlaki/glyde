/**
 * Scribe Pattern Scan Job
 *
 * Runs weekly, analyzing 14 days of user behavior to identify patterns
 * worth documenting as scribe notes in the knowledge graph.
 *
 * Recommended frequency: Weekly (Sunday night)
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/scribe-pattern-scan.ts
 */

import 'dotenv/config';
import { SupabaseService, initializeSupabase } from '../services/SupabaseService.js';
import { ScribeAgent } from '../agents/scribe/ScribeAgent.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

const MAX_CONCURRENT_USERS = 2;
const MIN_EVENTS_FOR_PATTERNS = 5;

async function runPatternScan(): Promise<void> {
  console.log('================================================================');
  console.log('[SCRIBE-PATTERNS] Starting weekly pattern scan...');
  console.log('================================================================');

  initializeSupabase();
  const supabase = new SupabaseService();
  ToolRegistry.getInstance();

  const { data: users, error } = await supabase.getClient()
    .from('profile')
    .select('id, timezone')
    .not('id', 'is', null);

  if (error || !users || users.length === 0) {
    console.log('[SCRIBE-PATTERNS] No users found');
    return;
  }

  console.log(`[SCRIBE-PATTERNS] Processing ${users.length} users...`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i += MAX_CONCURRENT_USERS) {
    const batch = users.slice(i, i + MAX_CONCURRENT_USERS);

    await Promise.allSettled(
      batch.map(async (user) => {
        try {
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

          const { count } = await supabase.getClient()
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('start_time', twoWeeksAgo.toISOString());

          if ((count || 0) < MIN_EVENTS_FOR_PATTERNS) {
            skipped++;
            return;
          }

          const scribe = new ScribeAgent();
          await scribe.initialize();

          await scribe.processMessage(
            {
              userId: user.id,
              sessionId: `scribe-patterns-${user.id}-${Date.now()}`,
              timezone: user.timezone || 'UTC',
              conversationHistory: [],
              isInternal: true,
            },
            'PATTERN_SCAN'
          );

          succeeded++;
          console.log(`[SCRIBE-PATTERNS] Completed for user ${user.id}`);
        } catch (err: any) {
          failed++;
          console.error(`[SCRIBE-PATTERNS] Error for user ${user.id}:`, err.message);
        }
      })
    );
  }

  console.log('================================================================');
  console.log(`[SCRIBE-PATTERNS] Complete: ${succeeded} succeeded, ${skipped} skipped, ${failed} failed`);
  console.log('================================================================');
}

runPatternScan().catch(console.error);
