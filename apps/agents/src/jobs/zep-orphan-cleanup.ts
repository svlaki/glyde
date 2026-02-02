/**
 * Zep Orphan Cleanup Job
 *
 * Background job that finds and invalidates Zep nodes that no longer exist in Supabase.
 * This cleans up orphaned nodes caused by deletions that failed to sync to Zep.
 *
 * Strategy:
 * 1. For each user, search Zep for Task/Goal/CalendarEvent entities
 * 2. Extract entity titles from search results
 * 3. Compare against Supabase entities
 * 4. For orphaned entities (in Zep but not in Supabase), add invalidation facts
 *
 * Recommended frequency: Daily (e.g., 2 AM UTC)
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/zep-orphan-cleanup.ts
 */

import { SupabaseService } from '../services/SupabaseService.js';
import { ZepGraphService } from '../services/ZepGraphService.js';

const BATCH_SIZE = 50;
const MAX_CONCURRENT_USERS = 3;

interface CleanupResult {
  userId: string;
  orphanedTasks: number;
  orphanedGoals: number;
  orphanedEvents: number;
  invalidated: number;
  errors: string[];
}

interface CleanupSummary {
  usersProcessed: number;
  totalOrphanedTasks: number;
  totalOrphanedGoals: number;
  totalOrphanedEvents: number;
  totalInvalidated: number;
  errors: string[];
}

async function runOrphanCleanup(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('[ZEP-CLEANUP] Starting orphan cleanup job...');
  console.log('═══════════════════════════════════════════\n');

  const supabaseService = new SupabaseService();
  const supabase = supabaseService.getClient();

  const summary: CleanupSummary = {
    usersProcessed: 0,
    totalOrphanedTasks: 0,
    totalOrphanedGoals: 0,
    totalOrphanedEvents: 0,
    totalInvalidated: 0,
    errors: [],
  };

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profile')
      .select('id')
      .limit(BATCH_SIZE);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('[ZEP-CLEANUP] No users found\n');
      return;
    }

    console.log(`[ZEP-CLEANUP] Found ${users.length} users to process\n`);

    // Process users in batches
    for (let i = 0; i < users.length; i += MAX_CONCURRENT_USERS) {
      const batch = users.slice(i, i + MAX_CONCURRENT_USERS);
      const results = await Promise.all(
        batch.map(user => cleanupUserOrphans(user.id, supabaseService))
      );

      // Aggregate results
      results.forEach(result => {
        summary.usersProcessed++;
        summary.totalOrphanedTasks += result.orphanedTasks;
        summary.totalOrphanedGoals += result.orphanedGoals;
        summary.totalOrphanedEvents += result.orphanedEvents;
        summary.totalInvalidated += result.invalidated;
        summary.errors.push(...result.errors);
      });
    }

    // Log cleanup to sync log
    await supabase.from('zep_sync_log').insert({
      user_id: null,
      entity_type: 'cleanup',
      entity_id: null,
      operation: 'orphan_cleanup',
      status: summary.errors.length === 0 ? 'success' : 'partial',
      metadata: {
        users_processed: summary.usersProcessed,
        orphaned_tasks: summary.totalOrphanedTasks,
        orphaned_goals: summary.totalOrphanedGoals,
        orphaned_events: summary.totalOrphanedEvents,
        total_invalidated: summary.totalInvalidated,
        errors: summary.errors.slice(0, 10),
      },
    });

    // Print summary
    console.log('\n═══════════════════════════════════════════');
    console.log('[ZEP-CLEANUP] Job Complete');
    console.log('═══════════════════════════════════════════');
    console.log(`Users processed:      ${summary.usersProcessed}`);
    console.log(`Orphaned tasks:       ${summary.totalOrphanedTasks}`);
    console.log(`Orphaned goals:       ${summary.totalOrphanedGoals}`);
    console.log(`Orphaned events:      ${summary.totalOrphanedEvents}`);
    console.log(`Total invalidated:    ${summary.totalInvalidated}`);
    console.log(`Errors:               ${summary.errors.length}`);
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('[ZEP-CLEANUP] ❌ Job failed:', error);
    process.exit(1);
  }
}

async function cleanupUserOrphans(
  userId: string,
  supabaseService: SupabaseService
): Promise<CleanupResult> {
  const result: CleanupResult = {
    userId,
    orphanedTasks: 0,
    orphanedGoals: 0,
    orphanedEvents: 0,
    invalidated: 0,
    errors: [],
  };

  console.log(`[ZEP-CLEANUP] Processing user: ${userId}`);

  try {
    const zepGraphService = new ZepGraphService();

    // Get all Supabase entities for comparison
    const [tasks, goals, events] = await Promise.all([
      supabaseService.getTasks(userId).catch(() => []),
      supabaseService.getGoals(userId).catch(() => []),
      supabaseService.getEvents(userId).catch(() => []),
    ]);

    // Create sets of titles for quick lookup (case-insensitive)
    const taskTitles = new Set(tasks.map((t: any) => t.title?.toLowerCase()));
    const goalTitles = new Set(goals.map((g: any) => g.title?.toLowerCase()));
    const eventTitles = new Set(events.map((e: any) => e.title?.toLowerCase()));

    // Search Zep for tasks
    try {
      const zepTasks = await zepGraphService.searchUserGraphAdvanced(
        userId,
        'task',
        { entityTypes: ['Task'], scope: 'nodes' }
      );

      for (const node of zepTasks.nodes || []) {
        const nodeTitle = node.name?.toLowerCase() || node.data?.title?.toLowerCase();
        if (nodeTitle && !taskTitles.has(nodeTitle)) {
          // This task exists in Zep but not in Supabase - it's orphaned
          result.orphanedTasks++;

          // Add invalidation fact
          try {
            await zepGraphService.deleteTask(userId, 'orphan', nodeTitle);
            result.invalidated++;
            console.log(`  [ORPHAN] Invalidated task: ${nodeTitle}`);
          } catch (e) {
            result.errors.push(`Invalidate task "${nodeTitle}": ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`Search tasks: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Search Zep for goals
    try {
      const zepGoals = await zepGraphService.searchUserGraphAdvanced(
        userId,
        'goal',
        { entityTypes: ['Goal'], scope: 'nodes' }
      );

      for (const node of zepGoals.nodes || []) {
        const nodeTitle = node.name?.toLowerCase() || node.data?.title?.toLowerCase();
        if (nodeTitle && !goalTitles.has(nodeTitle)) {
          // This goal exists in Zep but not in Supabase - it's orphaned
          result.orphanedGoals++;

          // Add invalidation fact
          try {
            await zepGraphService.deleteGoal(userId, 'orphan', nodeTitle);
            result.invalidated++;
            console.log(`  [ORPHAN] Invalidated goal: ${nodeTitle}`);
          } catch (e) {
            result.errors.push(`Invalidate goal "${nodeTitle}": ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`Search goals: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Search Zep for events
    try {
      const zepEvents = await zepGraphService.searchUserGraphAdvanced(
        userId,
        'event meeting calendar',
        { entityTypes: ['CalendarEvent'], scope: 'nodes' }
      );

      for (const node of zepEvents.nodes || []) {
        const nodeTitle = node.name?.toLowerCase() || node.data?.title?.toLowerCase();
        if (nodeTitle && !eventTitles.has(nodeTitle)) {
          // This event exists in Zep but not in Supabase - it's orphaned
          result.orphanedEvents++;

          // Add invalidation fact
          try {
            await zepGraphService.deleteCalendarEvent(userId, 'orphan', nodeTitle);
            result.invalidated++;
            console.log(`  [ORPHAN] Invalidated event: ${nodeTitle}`);
          } catch (e) {
            result.errors.push(`Invalidate event "${nodeTitle}": ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`Search events: ${e instanceof Error ? e.message : String(e)}`);
    }

    const totalOrphans = result.orphanedTasks + result.orphanedGoals + result.orphanedEvents;
    console.log(`[ZEP-CLEANUP] User ${userId}: ${totalOrphans} orphans found, ${result.invalidated} invalidated\n`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`User ${userId}: ${errorMsg}`);
    console.error(`[ZEP-CLEANUP] ❌ Error processing user ${userId}:`, error);
  }

  return result;
}

// Run the job
runOrphanCleanup()
  .then(() => {
    console.log('[ZEP-CLEANUP] ✅ Job completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('[ZEP-CLEANUP] ❌ Job failed:', error);
    process.exit(1);
  });
