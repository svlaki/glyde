#!/usr/bin/env node

import dotenv from 'dotenv';
import { ZepGraphService } from '../dist/services/ZepGraphService.js';
import { ZepMemoryService } from '../dist/services/ZepMemoryService.js';

// Load environment variables
dotenv.config();

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/clear-user-graph.js <userId>');
  console.error('Example: node scripts/clear-user-graph.js user123');
  process.exit(1);
}

async function clearUserData() {
  try {
    console.log(`🧹 Clearing all Zep data for user: ${userId}`);
    console.log('This will:');
    console.log('  - Delete user from Zep (all episodes, facts, graph data)');
    console.log('  - Clear entity mappings from Supabase');
    console.log('  - Reinitialize user for fresh start\n');

    const graphService = new ZepGraphService();
    const memoryService = new ZepMemoryService();

    // Clear all graph data (episodes, facts, mappings)
    console.log('🔄 Clearing knowledge graph and entity mappings...');
    await graphService.cleanupUserGraph(userId);

    // Reinitialize user in Zep
    console.log('🔄 Reinitializing user in Zep...');
    await memoryService.initUser(userId, {
      email: `${userId}@example.com`,
      firstName: 'User',
      lastName: userId
    });

    console.log('\n✅ User data cleared successfully!');
    console.log(`✨ User ${userId} is ready for fresh data with improved Zep integration.`);
    console.log('\nNext steps:');
    console.log('  - Calendar events will now use thread.add_messages()');
    console.log('  - Better entity extraction from natural language');
    console.log('  - Temporal awareness for updates');
    console.log('  - Episode-based tracking for deletion');

  } catch (error) {
    console.error('\n❌ Error clearing user data:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

clearUserData();