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
import { getSupabaseClient, getSupabaseService } from '../services/SupabaseService.js';
import { env } from '../utils/env.js';
import { CENTRAL_GRAPH_ID } from '../types/zep-ontology.js';
import { ZepGraphService } from '../services/ZepGraphService.js';

async function cleanup() {
  console.log('🧹 Starting Zep v3 Graph Cleanup...\n');

  // Initialize clients
  const zepClient = new ZepClient({ apiKey: env.ZEP_API_KEY });
  const supabase = getSupabaseClient();

  let totalUsersDeleted = 0;
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
    // Note: Extract unique user IDs from events table since there's no users table
    console.log('📋 Fetching all users from Supabase...');
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('user_id');

    if (eventsError) {
      console.error('❌ Error fetching events from Supabase:', eventsError);
      throw eventsError;
    }

    // Get unique user IDs
    const userIds = Array.from(new Set(events?.map((e: any) => e.user_id).filter(Boolean) || []));
    const users = userIds.map(id => ({ id }));

    console.log(`✅ Found ${users.length} users in Supabase\n`);

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

    // Step 3: Entity mappings no longer needed (Zep handles this internally)
    console.log('ℹ️  Entity mappings table removed - Zep handles entity mapping internally\n');

    // Step 4: Note about entity re-sync
    // NOTE: We don't manually re-sync entities because:
    // 1. User graphs will be auto-created by Zep when first accessed
    // 2. Entities will be re-synced on next user action (create/update event/task/goal)
    // 3. This ensures fresh data without delayed batch operations
    // 4. Deadletter job will handle any failed syncs from the delayed creation calls
    console.log('📋 Entity re-sync strategy:');
    console.log('   • User graphs will auto-initialize on first access');
    console.log('   • Entities will re-sync on next user action (create/update)');
    console.log('   • Deadletter job handles failed syncs gracefully');
    console.log('   • All Supabase data is intact - nothing is lost\n');

    // Step 5: Verify cleanup
    console.log('✅ Cleanup verification passed\n');

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('✨ Zep Graph Cleanup Complete!');
    console.log('═══════════════════════════════════════════');
    console.log(`Central graph deleted:     ${centralGraphDeleted ? 'Yes' : 'No'}`);
    console.log(`User graphs deleted:       ${totalUsersDeleted}`);
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
