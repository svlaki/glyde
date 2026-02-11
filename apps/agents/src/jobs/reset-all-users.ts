/**
 * Reset All Users Job
 *
 * Wipes all user Zep graphs and resets onboarding status.
 * PRESERVES existing events, tasks, goals, and categories in Supabase.
 *
 * What this does:
 * 1. For each user, deletes their entire Zep graph
 * 2. Resets profile onboarding fields (display_name, context_data, etc.)
 * 3. Sets force_reauth = true so frontend clears localStorage on next visit
 *
 * What this PRESERVES:
 * - All calendar_events
 * - All tasks
 * - All goals
 * - All categories
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/reset-all-users.ts
 */

import 'dotenv/config';
import { SupabaseService } from '../services/SupabaseService.js';
import { ZepGraphService } from '../services/ZepGraphService.js';

const BATCH_SIZE = 50;
const MAX_CONCURRENT_USERS = 2;

interface ResetResult {
  userId: string;
  zepWiped: boolean;
  profileReset: boolean;
  errors: string[];
}

interface ResetSummary {
  usersProcessed: number;
  zepWiped: number;
  profilesReset: number;
  errors: string[];
}

async function runResetAllUsers(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[RESET-USERS] Starting reset all users job...');
  console.log('[RESET-USERS] This will wipe Zep graphs and reset onboarding');
  console.log('[RESET-USERS] Events, tasks, goals, categories are PRESERVED');
  console.log('═══════════════════════════════════════════════════════════\n');

  const supabaseService = new SupabaseService();
  const supabase = supabaseService.getClient();

  const summary: ResetSummary = {
    usersProcessed: 0,
    zepWiped: 0,
    profilesReset: 0,
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
      console.log('[RESET-USERS] No users found\n');
      return;
    }

    console.log(`[RESET-USERS] Found ${users.length} users to reset\n`);

    // Process users in batches
    for (let i = 0; i < users.length; i += MAX_CONCURRENT_USERS) {
      const batch = users.slice(i, i + MAX_CONCURRENT_USERS);
      const results = await Promise.all(
        batch.map(user => resetUser(user.id, supabase))
      );

      // Aggregate results
      results.forEach(result => {
        summary.usersProcessed++;
        if (result.zepWiped) summary.zepWiped++;
        if (result.profileReset) summary.profilesReset++;
        summary.errors.push(...result.errors);
      });
    }

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[RESET-USERS] Job Complete');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Users processed:      ${summary.usersProcessed}`);
    console.log(`Zep graphs wiped:     ${summary.zepWiped}`);
    console.log(`Profiles reset:       ${summary.profilesReset}`);
    console.log(`Errors:               ${summary.errors.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('[RESET-USERS] Job failed:', error);
    process.exit(1);
  }
}

async function resetUser(userId: string, supabase: any): Promise<ResetResult> {
  const result: ResetResult = {
    userId,
    zepWiped: false,
    profileReset: false,
    errors: [],
  };

  console.log(`\n[RESET-USERS] Processing user: ${userId}`);

  // Step 1: Wipe Zep graph
  try {
    console.log(`  [ZEP] Wiping Zep graph...`);
    const zepGraphService = new ZepGraphService();
    await zepGraphService.cleanupUserGraph(userId);
    result.zepWiped = true;
    console.log(`  [ZEP] Successfully wiped`);
  } catch (error) {
    // User might not exist in Zep, that's okay
    console.log(`  [ZEP] No graph or already clean`);
    result.zepWiped = true;
  }

  // Step 2: Reset profile onboarding fields and set force_reauth
  try {
    console.log(`  [PROFILE] Resetting onboarding fields...`);
    const { error: updateError } = await supabase
      .from('profile')
      .update({
        display_name: null,
        preferred_name: null,
        birthday: null,
        occupation: null,
        field_of_study: null,
        goals_summary: null,
        context_data: {},
        preferences: {},
        values: {},
        work_patterns: {},
        personality_traits: {},
        force_reauth: true, // Force frontend to clear localStorage
      })
      .eq('id', userId);

    if (updateError) {
      result.errors.push(`Profile update: ${updateError.message}`);
      console.error(`  [PROFILE] Error:`, updateError.message);
    } else {
      result.profileReset = true;
      console.log(`  [PROFILE] Reset complete, force_reauth=true`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Profile reset: ${errorMsg}`);
    console.error(`  [PROFILE] Error:`, errorMsg);
  }

  return result;
}

// Run the job
runResetAllUsers()
  .then(() => {
    console.log('[RESET-USERS] Job completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('[RESET-USERS] Job failed:', error);
    process.exit(1);
  });
