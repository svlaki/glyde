/**
 * Memory Tools - Zep v3 Dual-Graph Knowledge System
 *
 * Tools for searching and managing:
 * - User Graphs: Personal behavioral patterns, preferences, and history
 * - Central Graph: Cross-user insights and community patterns
 */

// Search tools
export { searchMemoryTool } from './search-memory.js';
export { searchUserMemoryTool } from './search-user-memory.js';
export { searchUserGraphTool } from './search-user-graph.js';
export { searchGroupPatternsTool } from './search-group-patterns.js';

// Add/update tools
export { addUserPatternTool } from './add-user-pattern.js';
export { addCommunityPatternTool } from './add-community-pattern.js';

// Export as collection for easy registration
export const memoryTools = [
  // Unified memory search (thread.get_user_context)
  (await import('./search-user-memory.js')).searchUserMemoryTool,

  // Legacy conversation memory search (threads)
  (await import('./search-memory.js')).searchMemoryTool,

  // Graph-based memory tools
  (await import('./search-user-graph.js')).searchUserGraphTool,
  (await import('./search-group-patterns.js')).searchGroupPatternsTool,

  // Pattern management tools
  (await import('./add-user-pattern.js')).addUserPatternTool,
  (await import('./add-community-pattern.js')).addCommunityPatternTool,
];
