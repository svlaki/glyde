/**
 * Cleanup Script: Clear All Zep Graphs and Entity Mappings
 *
 * This script completely resets the Zep knowledge graph infrastructure:
 * - Deletes central group graph from Zep
 * - Deletes all user graphs from Zep
 * - Clears all entity mappings from Supabase
 *
 * WARNING: This is destructive and cannot be undone!
 *
 * Usage: tsx src/scripts/cleanup-zep-graphs.ts
 */

import { ZepClient } from '@getzep/zep-cloud';
import { getSupabaseClient } from '../services/SupabaseService.js';
import { env } from '../utils/env.js';
import { CENTRAL_GRAPH_ID } from '../types/zep-ontology.js';

async function cleanup() {
  console.log('🧹 Starting Zep v3 Graph Cleanup...\n');

  // Initialize clients
  const zepClient = new ZepClient({ apiKey: env.ZEP_API_KEY });
  const supabase = getSupabaseClient();

  let totalUsersDeleted = 0;
  let totalMappingsDeleted = 0;
  let centralGraphDeleted = false;

  try {
    // Step 1: Delete central group graph
    console.log('🗑️  Deleting central group graph...');
    try {
      await zepClient.graph.delete(CENTRAL_GRAPH_ID);
      centralGraphDeleted = true;
      console.log(`✅ Deleted central graph: ${CENTRAL_GRAPH_ID}\n`);
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.status === 404) {
        console.log(`○ Central graph not found (already clean)\n`);
      } else {
        console.error(`⚠️  Error deleting central graph:`, error.message, '\n');
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

    // Step 2: Delete each user's graph from Zep
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

    // Step 3: Clear all entity mappings from Supabase
    console.log('🗑️  Clearing entity mappings from Supabase...');

    const { data: deletedMappings, error: mappingsError } = await supabase
      .from('entity_graph_mappings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows
      .select();

    if (mappingsError) {
      console.error('❌ Error deleting entity mappings:', mappingsError);
      throw mappingsError;
    }

    totalMappingsDeleted = deletedMappings?.length || 0;
    console.log(`✅ Deleted ${totalMappingsDeleted} entity mappings from Supabase\n`);

    // Step 4: Verify cleanup
    console.log('🔍 Verifying cleanup...');

    const { data: remainingMappings, error: verifyError } = await supabase
      .from('entity_graph_mappings')
      .select('id', { count: 'exact', head: true });

    if (verifyError) {
      console.error('❌ Error verifying cleanup:', verifyError);
    } else {
      const count = remainingMappings?.length || 0;
      if (count === 0) {
        console.log('✅ Verification passed: All entity mappings cleared\n');
      } else {
        console.warn(`⚠️  Warning: ${count} entity mappings still remain\n`);
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('✨ Cleanup Complete!');
    console.log('═══════════════════════════════════════════');
    console.log(`Central graph deleted:   ${centralGraphDeleted ? 'Yes' : 'No'}`);
    console.log(`User graphs deleted:     ${totalUsersDeleted}`);
    console.log(`Entity mappings cleared: ${totalMappingsDeleted}`);
    console.log('═══════════════════════════════════════════\n');

    console.log('📝 All Zep data cleared! The system will auto-reinitialize on next use:');
    console.log('   ✅ Custom ontology will be registered');
    console.log('   ✅ Central graph will be created');
    console.log('   ✅ Fact ratings will be configured');
    console.log('   ✅ Users will be initialized with new graph structure\n');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanup()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
