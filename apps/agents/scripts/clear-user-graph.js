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
    console.log(`🧹 Clearing graph data for user: ${userId}`);

    const graphService = new ZepGraphService();
    const memoryService = new ZepMemoryService();

    // Clear knowledge graph data
    console.log('🔄 Clearing knowledge graph...');
    await graphService.cleanupUserGraph(userId);

    // Initialize fresh user in memory service
    console.log('🔄 Reinitializing user in memory service...');
    await memoryService.initUser(userId, {
      email: `${userId}@example.com`,
      firstName: 'User',
      lastName: userId
    });

    console.log('✅ User data cleared successfully!');
    console.log(`✨ User ${userId} is ready for fresh data with the new services.`);

  } catch (error) {
    console.error('❌ Error clearing user data:', error.message);
    process.exit(1);
  }
}

clearUserData();