/**
 * Memory Tools - Zep v3 Dual-Graph Knowledge System (Consolidated)
 *
 * Unified tools for searching and managing:
 * - User Graphs: Personal behavioral patterns, preferences, and history
 * - Central Graph: Cross-user insights and community patterns
 *
 * Tool Consolidation (Nov 2024):
 * - 4 separate search tools → 1 unified search-memory-unified
 * - 2 separate pattern tools → 1 unified manage-patterns
 * - Added update-memory-advanced for proactive memory persistence (Jan 2025)
 */

// Unified search tool (consolidates: search-memory, search-user-memory, search-user-graph, search-group-patterns)
export { searchMemoryUnifiedTool } from './search-memory-unified.js';

// Unified pattern management (consolidates: add-user-pattern, add-community-pattern)
export { managePatternsTool } from './manage-patterns.js';

// Advanced memory update tool (proactive persistence with rich metadata)
export { updateMemoryAdvancedTool } from './update-memory-advanced.js';

// Export as collection for easy registration
export const memoryTools = [
  (await import('./search-memory-unified.js')).searchMemoryUnifiedTool,
  (await import('./manage-patterns.js')).managePatternsTool,
  (await import('./update-memory-advanced.js')).updateMemoryAdvancedTool,
];
