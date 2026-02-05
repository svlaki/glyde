/**
 * Clear Single User Graph Script
 *
 * This script clears a specific user's Zep graph and entity mappings for testing.
 * Perfect for testing new memory implementations without affecting other users.
 *
 * Usage:
 *   tsx apps/agents/src/scripts/clear-user-graph.ts <user-id>
 *
 * Example:
 *   tsx apps/agents/src/scripts/clear-user-graph.ts 550e8400-e29b-41d4-a716-446655440000
 */

import { ZepClient } from '@getzep/zep-cloud';
import { getSupabaseClient } from '../services/SupabaseService.js';
import { env } from '../utils/env.js';

async function clearUserGraph(userId: string) {
  console.log('Starting User Graph Cleanup...\n');
  console.log(`👤 Target User ID: ${userId}\n`);

  // Initialize clients
  const zepClient = new ZepClient({ apiKey: env.ZEP_API_KEY });
  const supabase = getSupabaseClient();

  try {
    // Step 1: Verify user exists in Supabase (optional - just for logging)
    console.log('🔍 Checking user in Supabase...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.log(` User not found in Supabase (may only exist in Zep)`);
      console.log(`Proceeding with Zep cleanup for: ${userId}\n`);
    } else {
      console.log(`User found: ${user.email || userId}\n`);
    }

    // Step 2: Delete user's graph from Zep
    console.log(' Deleting user graph from Zep...');
    try {
      await zepClient.user.delete(userId);
      console.log(`Deleted user graph for: ${userId}\n`);
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.status === 404) {
        console.log(`○ User graph not found in Zep (already clean)\n`);
      } else {
        console.error(` Error deleting user graph:`, error.message);
        throw error;
      }
    }

    // Step 3: Clear user's entity mappings from Supabase
    console.log(' Clearing entity mappings from Supabase...');
    const { data: deletedMappings, error: mappingsError } = await supabase
      .from('events -- DEPRECATED: entity_graph_mappings removed')
      .delete()
      .eq('user_id', userId)
      .select();

    if (mappingsError) {
      console.error('Error deleting entity mappings:', mappingsError);
      throw mappingsError;
    }

    const mappingsCount = deletedMappings?.length || 0;
    console.log(`Deleted ${mappingsCount} entity mappings\n`);

    // Step 4: Note about threads
    // In Zep v3, threads are automatically cleaned up when the user is deleted
    // No need for separate session cleanup
    console.log('ℹ️  Threads will be auto-cleaned when user is deleted\n');

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('User Graph Cleanup Complete!');
    console.log('═══════════════════════════════════════════');
    console.log(`User ID:             ${userId}`);
    console.log(`User Email:          ${user?.email || 'N/A'}`);
    console.log(`Graph:               Deleted `);
    console.log(`Entity Mappings:     ${mappingsCount} cleared`);
    console.log('═══════════════════════════════════════════\n');

    console.log('Next steps:');
    console.log('   User graph will be auto-reinitialized on next conversation');
    console.log('   Custom ontology and fact ratings will be configured');
    console.log('   Test your new memory implementation!\n');

    console.log('Testing the new update_memory_advanced tool:');
    console.log('   1. Start a conversation as this user');
    console.log('   2. Share important preferences: "I hate morning meetings"');
    console.log('   3. Agent should call update_memory_advanced');
    console.log('   4. Verify memory persisted with search_memory_unified\n');

  } catch (error) {
    console.error('\nCleanup failed:', error);
    process.exit(1);
  }
}

// Get user ID from command line
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: tsx clear-user-graph.ts <user-id>');
  console.log('\nExample:');
  console.log('  tsx apps/agents/src/scripts/clear-user-graph.ts 550e8400-e29b-41d4-a716-446655440000\n');
  console.log('Tips:');
  console.log('  - Get user ID from Supabase users table');
  console.log('  - Or from auth.users in Supabase dashboard');
  console.log('  - User ID is a UUID format\n');
  process.exit(1);
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(userId)) {
  console.error('Invalid user ID format. Expected UUID format.');
  console.log('Example: 550e8400-e29b-41d4-a716-446655440000\n');
  process.exit(1);
}

// Run cleanup
clearUserGraph(userId)
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
