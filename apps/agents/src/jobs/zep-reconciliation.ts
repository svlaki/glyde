/**
 * Zep Reconciliation Job
 *
 * Background job that compares Supabase entity state with Zep and syncs missing entities.
 * This ensures eventual consistency between the database and Zep knowledge graph.
 *
 * Features:
 * - Fetches users with recent activity
 * - For each user, compares tasks/goals/events in Supabase vs Zep
 * - Adds missing entities to Zep in batches
 * - Tracks reconciliation in zep_sync_log
 *
 * Recommended frequency: Every 6 hours
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/zep-reconciliation.ts
 */

import { SupabaseService } from '../services/SupabaseService.js';
import { ZepGraphService } from '../services/ZepGraphService.js';

const BATCH_SIZE = 50;
const MAX_CONCURRENT_USERS = 5;
const ACTIVITY_WINDOW_HOURS = 24;

interface ReconciliationResult {
  userId: string;
  tasksAdded: number;
  goalsAdded: number;
  eventsAdded: number;
  errors: string[];
}

interface ReconciliationSummary {
  usersProcessed: number;
  totalTasksAdded: number;
  totalGoalsAdded: number;
  totalEventsAdded: number;
  errors: string[];
}

async function runReconciliation(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('[ZEP-RECONCILIATION] Starting reconciliation job...');
  console.log(`[ZEP-RECONCILIATION] Activity window: ${ACTIVITY_WINDOW_HOURS} hours`);
  console.log('═══════════════════════════════════════════\n');

  const supabaseService = new SupabaseService();
  const supabase = supabaseService.getClient();

  const summary: ReconciliationSummary = {
    usersProcessed: 0,
    totalTasksAdded: 0,
    totalGoalsAdded: 0,
    totalEventsAdded: 0,
    errors: [],
  };

  try {
    // Get users with recent activity
    const activityCutoff = new Date(Date.now() - ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000);

    // Find users who have tasks, goals, or events created/updated recently
    const { data: activeUsers, error: usersError } = await supabase
      .from('profile')
      .select('id, first_name, last_name')
      .order('updated_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('[ZEP-RECONCILIATION] No users found to reconcile\n');
      return;
    }

    console.log(`[ZEP-RECONCILIATION] Found ${activeUsers.length} users to process\n`);

    // Process users in batches with concurrency control
    for (let i = 0; i < activeUsers.length; i += MAX_CONCURRENT_USERS) {
      const batch = activeUsers.slice(i, i + MAX_CONCURRENT_USERS);
      const results = await Promise.all(
        batch.map(user => reconcileUser(user.id, supabaseService))
      );

      // Aggregate results
      results.forEach(result => {
        summary.usersProcessed++;
        summary.totalTasksAdded += result.tasksAdded;
        summary.totalGoalsAdded += result.goalsAdded;
        summary.totalEventsAdded += result.eventsAdded;
        summary.errors.push(...result.errors);
      });
    }

    // Log reconciliation to sync log
    await supabase.from('zep_sync_log').insert({
      user_id: null,
      entity_type: 'reconciliation',
      entity_id: null,
      operation: 'batch_reconciliation',
      status: summary.errors.length === 0 ? 'success' : 'partial',
      metadata: {
        users_processed: summary.usersProcessed,
        tasks_added: summary.totalTasksAdded,
        goals_added: summary.totalGoalsAdded,
        events_added: summary.totalEventsAdded,
        errors: summary.errors.slice(0, 10), // Limit errors stored
      },
    });

    // Print summary
    console.log('\n═══════════════════════════════════════════');
    console.log('[ZEP-RECONCILIATION] Job Complete');
    console.log('═══════════════════════════════════════════');
    console.log(`Users processed:    ${summary.usersProcessed}`);
    console.log(`Tasks added:        ${summary.totalTasksAdded}`);
    console.log(`Goals added:        ${summary.totalGoalsAdded}`);
    console.log(`Events added:       ${summary.totalEventsAdded}`);
    console.log(`Errors:             ${summary.errors.length}`);
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('[ZEP-RECONCILIATION] ❌ Job failed:', error);
    process.exit(1);
  }
}

async function reconcileUser(
  userId: string,
  supabaseService: SupabaseService
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    userId,
    tasksAdded: 0,
    goalsAdded: 0,
    eventsAdded: 0,
    errors: [],
  };

  console.log(`[ZEP-RECONCILIATION] Processing user: ${userId}`);

  try {
    const zepGraphService = new ZepGraphService();

    // Ensure user exists in Zep
    try {
      await zepGraphService.initializeUserWithRatings(userId);
    } catch (e) {
      // User may already exist, continue
    }

    // Reconcile Tasks
    try {
      const tasks = await supabaseService.getTasks(userId);
      const activeTasks = tasks.filter((t: any) => t.status !== 'completed');

      for (const task of activeTasks) {
        try {
          // Search Zep for this task by title
          const searchResult = await zepGraphService.searchUserGraphAdvanced(
            userId,
            task.title,
            { entityTypes: ['Task'], scope: 'nodes' }
          );

          // Check for match using supabase_id (precise) or fallback to title (legacy)
          const hasMatch = searchResult.nodes.some((n: any) => {
            // Try to parse node data to check for supabase_id
            try {
              const nodeData = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
              if (nodeData?.supabase_id === task.id) return true;
            } catch {}
            // Fallback to title matching for legacy nodes
            return n.name?.toLowerCase().includes(task.title.toLowerCase()) ||
                   n.data?.title?.toLowerCase() === task.title.toLowerCase();
          });

          if (!hasMatch) {
            await zepGraphService.addTask(userId, {
              taskId: task.id,
              title: task.title,
              priority: task.priority || 'medium',
              category: task.category,
              energy_required: task.energy_required || 'medium',
            });
            result.tasksAdded++;
            console.log(`  [TASK] Added: ${task.title}`);
          }
        } catch (taskError) {
          result.errors.push(`Task ${task.id}: ${taskError instanceof Error ? taskError.message : String(taskError)}`);
        }
      }
    } catch (e) {
      result.errors.push(`Tasks fetch: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Reconcile Goals
    try {
      const goals = await supabaseService.getGoals(userId);
      const activeGoals = goals.filter((g: any) => g.status === 'active');

      for (const goal of activeGoals) {
        try {
          // Search Zep for this goal by title
          const searchResult = await zepGraphService.searchUserGraphAdvanced(
            userId,
            goal.title,
            { entityTypes: ['Goal'], scope: 'nodes' }
          );

          // Check for match using supabase_id (precise) or fallback to title (legacy)
          const hasMatch = searchResult.nodes.some((n: any) => {
            // Try to parse node data to check for supabase_id
            try {
              const nodeData = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
              if (nodeData?.supabase_id === goal.id) return true;
            } catch {}
            // Fallback to title matching for legacy nodes
            return n.name?.toLowerCase().includes(goal.title.toLowerCase()) ||
                   n.data?.title?.toLowerCase() === goal.title.toLowerCase();
          });

          if (!hasMatch) {
            await zepGraphService.addGoal(userId, {
              goalId: goal.id,
              title: goal.title,
              goal_type: goal.goal_type || 'custom',
              status: goal.status || 'active',
              progress_percentage: goal.progress || 0,
              deadline: goal.target_date,
            });
            result.goalsAdded++;
            console.log(`  [GOAL] Added: ${goal.title}`);
          }
        } catch (goalError) {
          result.errors.push(`Goal ${goal.id}: ${goalError instanceof Error ? goalError.message : String(goalError)}`);
        }
      }
    } catch (e) {
      result.errors.push(`Goals fetch: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Reconcile Events (only recent/future events)
    try {
      const events = await supabaseService.getEventsForAgent(userId);
      const now = new Date();
      const recentEvents = events.filter((e: any) => new Date(e.start_time) >= now);

      // Limit to most recent 20 events to avoid overwhelming Zep
      const eventsToSync = recentEvents.slice(0, 20);

      for (const event of eventsToSync) {
        try {
          // Search Zep for this event by title
          const searchResult = await zepGraphService.searchUserGraphAdvanced(
            userId,
            event.title,
            { entityTypes: ['CalendarEvent'], scope: 'nodes' }
          );

          // Check for match using supabase_id (precise) or fallback to title (legacy)
          const hasMatch = searchResult.nodes.some((n: any) => {
            // Try to parse node data to check for supabase_id
            try {
              const nodeData = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
              if (nodeData?.supabase_id === event.id) return true;
            } catch {}
            // Fallback to title matching for legacy nodes
            return n.name?.toLowerCase().includes(event.title.toLowerCase()) ||
                   n.data?.title?.toLowerCase() === event.title.toLowerCase();
          });

          if (!hasMatch) {
            const durationMinutes = event.end_time && event.start_time
              ? Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000)
              : 60;

            await zepGraphService.addCalendarEvent(userId, {
              eventId: event.id,
              title: event.title,
              category: event.category || 'personal',
              duration_minutes: durationMinutes,
              location: event.location,
            });
            result.eventsAdded++;
            console.log(`  [EVENT] Added: ${event.title}`);
          }
        } catch (eventError) {
          result.errors.push(`Event ${event.id}: ${eventError instanceof Error ? eventError.message : String(eventError)}`);
        }
      }
    } catch (e) {
      result.errors.push(`Events fetch: ${e instanceof Error ? e.message : String(e)}`);
    }

    console.log(`[ZEP-RECONCILIATION] User ${userId}: +${result.tasksAdded} tasks, +${result.goalsAdded} goals, +${result.eventsAdded} events\n`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`User ${userId}: ${errorMsg}`);
    console.error(`[ZEP-RECONCILIATION] ❌ Error processing user ${userId}:`, error);
  }

  return result;
}

// Run the job
runReconciliation()
  .then(() => {
    console.log('[ZEP-RECONCILIATION] ✅ Job completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('[ZEP-RECONCILIATION] ❌ Job failed:', error);
    process.exit(1);
  });
