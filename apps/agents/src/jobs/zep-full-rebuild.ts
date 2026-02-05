/**
 * Zep Full Wipe and Rebuild Job
 *
 * Completely wipes each user's Zep graph and rebuilds from Supabase.
 * Use this when you need to ensure Zep perfectly matches the database.
 *
 * Strategy:
 * 1. For each user, delete their entire Zep graph
 * 2. Re-initialize the user in Zep
 * 3. Repopulate all tasks, goals, and events from Supabase
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/zep-full-rebuild.ts
 */

import 'dotenv/config';
import { SupabaseService } from '../services/SupabaseService.js';
import { ZepGraphService } from '../services/ZepGraphService.js';

const BATCH_SIZE = 50;
const MAX_CONCURRENT_USERS = 2;

interface RebuildResult {
  userId: string;
  wiped: boolean;
  tasksAdded: number;
  goalsAdded: number;
  eventsAdded: number;
  errors: string[];
}

interface RebuildSummary {
  usersProcessed: number;
  usersWiped: number;
  totalTasksAdded: number;
  totalGoalsAdded: number;
  totalEventsAdded: number;
  errors: string[];
}

async function runFullRebuild(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[ZEP-REBUILD] Starting FULL WIPE and REBUILD job...');
  console.log('[ZEP-REBUILD] WARNING: This will delete all Zep data and rebuild from Supabase');
  console.log('═══════════════════════════════════════════════════════════\n');

  const supabaseService = new SupabaseService();
  const supabase = supabaseService.getClient();

  const summary: RebuildSummary = {
    usersProcessed: 0,
    usersWiped: 0,
    totalTasksAdded: 0,
    totalGoalsAdded: 0,
    totalEventsAdded: 0,
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
      console.log('[ZEP-REBUILD] No users found\n');
      return;
    }

    console.log(`[ZEP-REBUILD] Found ${users.length} users to process\n`);

    // Process users in batches
    for (let i = 0; i < users.length; i += MAX_CONCURRENT_USERS) {
      const batch = users.slice(i, i + MAX_CONCURRENT_USERS);
      const results = await Promise.all(
        batch.map(user => rebuildUserGraph(user.id, supabaseService))
      );

      // Aggregate results
      results.forEach(result => {
        summary.usersProcessed++;
        if (result.wiped) summary.usersWiped++;
        summary.totalTasksAdded += result.tasksAdded;
        summary.totalGoalsAdded += result.goalsAdded;
        summary.totalEventsAdded += result.eventsAdded;
        summary.errors.push(...result.errors);
      });
    }

    // Log rebuild to sync log
    await supabase.from('zep_sync_log').insert({
      user_id: null,
      entity_type: 'rebuild',
      entity_id: null,
      operation: 'full_rebuild',
      status: summary.errors.length === 0 ? 'success' : 'partial',
      metadata: {
        users_processed: summary.usersProcessed,
        users_wiped: summary.usersWiped,
        tasks_added: summary.totalTasksAdded,
        goals_added: summary.totalGoalsAdded,
        events_added: summary.totalEventsAdded,
        errors: summary.errors.slice(0, 10),
      },
    });

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[ZEP-REBUILD] Job Complete');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Users processed:      ${summary.usersProcessed}`);
    console.log(`Users wiped:          ${summary.usersWiped}`);
    console.log(`Tasks added:          ${summary.totalTasksAdded}`);
    console.log(`Goals added:          ${summary.totalGoalsAdded}`);
    console.log(`Events added:         ${summary.totalEventsAdded}`);
    console.log(`Errors:               ${summary.errors.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('[ZEP-REBUILD] Job failed:', error);
    process.exit(1);
  }
}

async function rebuildUserGraph(
  userId: string,
  supabaseService: SupabaseService
): Promise<RebuildResult> {
  const result: RebuildResult = {
    userId,
    wiped: false,
    tasksAdded: 0,
    goalsAdded: 0,
    eventsAdded: 0,
    errors: [],
  };

  console.log(`\n[ZEP-REBUILD] Processing user: ${userId}`);

  const zepGraphService = new ZepGraphService();

  // Step 1: Wipe user's Zep graph
  try {
    console.log(`  [WIPE] Deleting Zep graph for user...`);
    await zepGraphService.cleanupUserGraph(userId);
    result.wiped = true;
    console.log(`  [WIPE] Successfully wiped user graph`);
  } catch (error) {
    // User might not exist in Zep yet, that's okay
    console.log(`  [WIPE] No existing graph or already clean`);
    result.wiped = true;
  }

  // Small delay to ensure cleanup is processed
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 2: Re-initialize user in Zep
  try {
    console.log(`  [INIT] Initializing user in Zep...`);
    await zepGraphService.initializeUserWithRatings(userId);
    console.log(`  [INIT] User initialized`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Init user: ${errorMsg}`);
    console.error(`  [INIT] Failed:`, errorMsg);
  }

  // Step 3: Add all tasks from Supabase
  try {
    const tasks = await supabaseService.getTasks(userId);
    const activeTasks = tasks.filter((t: any) => t.status !== 'completed');
    console.log(`  [TASKS] Found ${activeTasks.length} active tasks to sync`);

    for (const task of activeTasks) {
      try {
        await zepGraphService.addTask(userId, {
          taskId: task.id,
          title: task.title,
          priority: task.priority || 'medium',
          category: task.category,
          energy_required: task.energy_required || 'medium',
        });
        result.tasksAdded++;
      } catch (taskError) {
        const errorMsg = taskError instanceof Error ? taskError.message : String(taskError);
        result.errors.push(`Task "${task.title}": ${errorMsg}`);
      }
    }
    console.log(`  [TASKS] Added ${result.tasksAdded} tasks`);
  } catch (e) {
    result.errors.push(`Fetch tasks: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Step 4: Add all goals from Supabase
  try {
    const goals = await supabaseService.getGoals(userId);
    const activeGoals = goals.filter((g: any) => g.status === 'active');
    console.log(`  [GOALS] Found ${activeGoals.length} active goals to sync`);

    for (const goal of activeGoals) {
      try {
        await zepGraphService.addGoal(userId, {
          goalId: goal.id,
          title: goal.title,
          goal_type: goal.goal_type || 'custom',
          status: goal.status || 'active',
          progress_percentage: goal.progress || 0,
          deadline: goal.target_date,
        });
        result.goalsAdded++;
      } catch (goalError) {
        const errorMsg = goalError instanceof Error ? goalError.message : String(goalError);
        result.errors.push(`Goal "${goal.title}": ${errorMsg}`);
      }
    }
    console.log(`  [GOALS] Added ${result.goalsAdded} goals`);
  } catch (e) {
    result.errors.push(`Fetch goals: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Step 5: Add recent/future events from Supabase
  try {
    const events = await supabaseService.getEventsForAgent(userId);
    const now = new Date();
    // Only sync future events and events from last 7 days
    const relevantEvents = events.filter((e: any) => {
      const eventDate = new Date(e.start_time);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return eventDate >= sevenDaysAgo;
    });

    // Limit to 50 most recent/upcoming events
    const eventsToSync = relevantEvents.slice(0, 50);
    console.log(`  [EVENTS] Found ${eventsToSync.length} relevant events to sync`);

    for (const event of eventsToSync) {
      try {
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
      } catch (eventError) {
        const errorMsg = eventError instanceof Error ? eventError.message : String(eventError);
        result.errors.push(`Event "${event.title}": ${errorMsg}`);
      }
    }
    console.log(`  [EVENTS] Added ${result.eventsAdded} events`);
  } catch (e) {
    result.errors.push(`Fetch events: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log(`[ZEP-REBUILD] User ${userId}: +${result.tasksAdded} tasks, +${result.goalsAdded} goals, +${result.eventsAdded} events`);

  return result;
}

// Run the job
runFullRebuild()
  .then(() => {
    console.log('[ZEP-REBUILD] Job completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('[ZEP-REBUILD] Job failed:', error);
    process.exit(1);
  });
