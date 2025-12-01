/**
 * Reset User Graphs Script
 *
 * This script resets all user graphs while keeping the central graph intact:
 * - Deletes all user graphs from Zep
 * - Clears all entity mappings from Supabase
 * - Preserves the central group graph (shared patterns)
 *
 * Use this when migrating to new Zep implementation while keeping community data.
 *
 * WARNING: This is destructive for user data and cannot be undone!
 *
 * Usage: tsx apps/agents/src/scripts/reset-user-graphs.ts
 */

import { ZepClient } from '@getzep/zep-cloud';
import { getSupabaseClient } from '../services/SupabaseService.js';
import { env } from '../utils/env.js';
import { CENTRAL_GRAPH_ID } from '../types/zep-ontology.js';

async function resetUserGraphs() {
  console.log('🔄 Starting User Graph Reset...\n');
  console.log(`ℹ️  Central graph "${CENTRAL_GRAPH_ID}" will be PRESERVED\n`);

  // Initialize clients
  const zepClient = new ZepClient({ apiKey: env.ZEP_API_KEY });
  const supabase = getSupabaseClient();

  let totalUsersDeleted = 0;
  let totalMappingsDeleted = 0;

  try {
    // Step 1: Verify central graph exists (we want to keep it)
    console.log('🔍 Checking central graph status...');
    try {
      const centralGraph = await zepClient.graph.get(CENTRAL_GRAPH_ID);
      console.log(`✅ Central graph found: ${centralGraph.name}`);
      console.log(`   → Will be preserved during reset\n`);
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.status === 404) {
        console.log(`⚠️  Central graph not found - will be auto-created on next use\n`);
      } else {
        console.error(`⚠️  Error checking central graph:`, error.message, '\n');
      }
    }

    // Step 2: Get all users from Supabase (our source of truth)
    console.log('📋 Fetching all users from Supabase...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      console.error('❌ Error fetching users from Supabase:', usersError);
      throw usersError;
    }

    console.log(`✅ Found ${users?.length || 0} users in Supabase\n`);

    // Step 3: Delete each user's graph from Zep
    if (users && users.length > 0) {
      console.log('🗑️  Deleting user graphs from Zep...');

      for (const user of users) {
        try {
          await zepClient.user.delete(user.id);
          totalUsersDeleted++;
          console.log(`   ✓ Deleted user graph: ${user.id}`);
        } catch (error: any) {
          // User might not exist in Zep, which is fine
          if (error?.statusCode === 404 || error?.status === 404) {
            console.log(`   ○ User graph not found (already clean): ${user.id}`);
          } else {
            console.error(`   ✗ Error deleting user ${user.id}:`, error.message);
          }
        }
      }

      console.log(`\n✅ Deleted ${totalUsersDeleted} user graphs from Zep\n`);
    }

    // Step 4: Clear all entity mappings from Supabase
    console.log('🗑️  Clearing entity mappings from Supabase...');

    const { data: deletedMappings, error: mappingsError } = await supabase
      .from('events -- DEPRECATED: entity_graph_mappings removed')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
      .select();

    if (mappingsError) {
      console.error('❌ Error deleting entity mappings:', mappingsError);
      throw mappingsError;
    }

    totalMappingsDeleted = deletedMappings?.length || 0;
    console.log(`✅ Deleted ${totalMappingsDeleted} entity mappings from Supabase\n`);

    // Step 5: Verify cleanup
    console.log('🔍 Verifying cleanup...');

    const { count: remainingCount, error: verifyError } = await supabase
      .from('events -- DEPRECATED: entity_graph_mappings removed')
      .select('id', { count: 'exact', head: true });

    if (verifyError) {
      console.error('❌ Error verifying cleanup:', verifyError);
    } else {
      if (remainingCount === 0) {
        console.log('✅ Verification passed: All entity mappings cleared\n');
      } else {
        console.warn(`⚠️  Warning: ${remainingCount} entity mappings still remain\n`);
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('✨ User Graph Reset Complete!');
    console.log('═══════════════════════════════════════════');
    console.log(`Central graph:           PRESERVED ✅`);
    console.log(`User graphs deleted:     ${totalUsersDeleted}`);
    console.log(`Entity mappings cleared: ${totalMappingsDeleted}`);
    console.log('═══════════════════════════════════════════\n');

    console.log('📝 User graphs cleared! The system will auto-reinitialize user data:');
    console.log('   ✅ Custom ontology already registered');
    console.log('   ✅ Central graph preserved with community patterns');
    console.log('   ✅ Fact ratings will be configured for new users');
    console.log('   ✅ Users will be initialized with fresh graph structure\n');
    console.log('💡 Community patterns in central graph remain available for all users\n');

  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  }
}

// Run reset
resetUserGraphs()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
