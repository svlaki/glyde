/**
 * Shared routing types used by ToolRegistry and agents.
 */

/**
 * Tool categories for selective tool binding.
 * Used by ToolRegistry for getToolsByCategory, getToolsForCategories, etc.
 */
export type ToolCategory =
  | 'calendar_core'       // create, update, delete, search, list (5 tools)
  | 'calendar_advanced'   // bulk ops, recurring, analyze, free time (7 tools)
  | 'tasks'               // create, update, delete, list, complete, search (6 tools)
  | 'goals'               // create, update, list, check_in, delete (5 tools)
  | 'aspects'             // create, list, update, delete, archive (5 tools)
  | 'reminders'
  | 'friends'
  | 'shared-events'
  | 'shared-aspects'
  | 'memory'
  | 'rules'
  | 'search'
  | 'profile'
  | 'projects'
  | 'plans'
  | 'notes'
  | 'suggestions';
