/**
 * Force Reauth All Users Job
 *
 * Sets force_reauth = true for all users, which will:
 * 1. Clear their localStorage onboardingData on next login
 * 2. Redirect them to the onboarding flow
 *
 * This is useful when:
 * - Zep architecture changes require re-seeding
 * - Onboarding flow has been updated
 *
 * PRESERVES all existing data (events, tasks, goals, categories, profile info)
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/force-reauth-all.ts
 */

import 'dotenv/config';
import { SupabaseService } from '../services/SupabaseService.js';

async function runForceReauthAll(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('[FORCE-REAUTH] Setting force_reauth=true for all users...');
  console.log('[FORCE-REAUTH] This will trigger onboarding on next login');
  console.log('[FORCE-REAUTH] All existing data is PRESERVED');
  console.log('═══════════════════════════════════════════════════════════\n');

  const supabaseService = new SupabaseService();
  const supabase = supabaseService.getClient();

  try {
    // Update all users at once
    const { data, error } = await supabase
      .from('profile')
      .update({ force_reauth: true })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Exclude any system users
      .select('id');

    if (error) {
      throw new Error(`Failed to update users: ${error.message}`);
    }

    const count = data?.length || 0;
    console.log(`Updated ${count} users with force_reauth=true`);
    console.log('\nUsers will be redirected to onboarding on next login.');
    console.log('Their existing categories, goals, and events are preserved.');

  } catch (error) {
    console.error('[FORCE-REAUTH] Job failed:', error);
    process.exit(1);
  }
}

// Run the job
runForceReauthAll()
  .then(() => {
    console.log('\n[FORCE-REAUTH] Job completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('[FORCE-REAUTH] Job failed:', error);
    process.exit(1);
  });
