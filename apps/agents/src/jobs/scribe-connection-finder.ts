/**
 * Scribe Connection Finder Job
 *
 * Runs weekly, analyzing notes and goals across aspects to discover
 * non-obvious connections between life areas.
 *
 * Recommended frequency: Weekly (midweek)
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/scribe-connection-finder.ts
 */

import 'dotenv/config';
import { SupabaseService, initializeSupabase } from '../services/SupabaseService.js';
import { ScribeAgent } from '../agents/scribe/ScribeAgent.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

const MAX_CONCURRENT_USERS = 2;
const MIN_NOTES_FOR_CONNECTIONS = 3;

async function runConnectionFinder(): Promise<void> {
  console.log('================================================================');
  console.log('[SCRIBE-CONNECTIONS] Starting weekly connection scan...');
  console.log('================================================================');

  initializeSupabase();
  const supabase = new SupabaseService();
  ToolRegistry.getInstance();

  const { data: users, error } = await supabase.getClient()
    .from('profile')
    .select('id, timezone')
    .not('id', 'is', null);

  if (error || !users || users.length === 0) {
    console.log('[SCRIBE-CONNECTIONS] No users found');
    return;
  }

  console.log(`[SCRIBE-CONNECTIONS] Processing ${users.length} users...`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i += MAX_CONCURRENT_USERS) {
    const batch = users.slice(i, i + MAX_CONCURRENT_USERS);

    await Promise.allSettled(
      batch.map(async (user) => {
        try {
          const { count } = await supabase.getClient()
            .from('notes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .neq('status', 'archived');

          if ((count || 0) < MIN_NOTES_FOR_CONNECTIONS) {
            skipped++;
            return;
          }

          const scribe = new ScribeAgent();
          await scribe.initialize();

          await scribe.processMessage(
            {
              userId: user.id,
              sessionId: `scribe-connections-${user.id}-${Date.now()}`,
              timezone: user.timezone || 'UTC',
              conversationHistory: [],
              isInternal: true,
            },
            'CONNECTION_SCAN'
          );

          succeeded++;
          console.log(`[SCRIBE-CONNECTIONS] Completed for user ${user.id}`);
        } catch (err: any) {
          failed++;
          console.error(`[SCRIBE-CONNECTIONS] Error for user ${user.id}:`, err.message);
        }
      })
    );
  }

  console.log('================================================================');
  console.log(`[SCRIBE-CONNECTIONS] Complete: ${succeeded} succeeded, ${skipped} skipped, ${failed} failed`);
  console.log('================================================================');
}

runConnectionFinder().catch(console.error);
