/**
 * Shared routing types used by ContextRouter, ToolRegistry, and prompts.
 * Extracted to avoid circular dependencies.
 */

/**
 * Tool categories that can be selectively bound to the model.
 * Other categories are added by the router based on message intent.
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
  | 'memory'
  | 'rules'
  | 'search'
  | 'profile'
  | 'projects'
  | 'plans';

/**
 * Prompt section identifiers for conditional prompt assembly.
 * "core" is always included.
 */
export type PromptSection =
  | 'core'
  | 'calendar_detail'
  | 'goal_creation'
  | 'recurring_events'
  | 'friends_sharing'
  | 'location_search'
  | 'memory_management'
  | 'plans_detail'
  | 'reminders';

/**
 * Context detail level for the system prompt.
 * - 'summary': compact 1-2 line overview (for greetings, general chat)
 * - 'full': detailed listings (for schedule questions, action requests)
 */
export type ContextMode = 'summary' | 'full';

export interface RoutingDecision {
  needs_tools: boolean;
  tools?: string[];              // specific tool names when needs_tools=true
  tool_categories: ToolCategory[];
  context_mode: ContextMode;
  context_sections: {
    events: boolean;
    tasks: boolean;
    goals: boolean;
    friends: boolean;
    rules: boolean;
    activity_logs: boolean;
    ratings: boolean;
    projects: boolean;
  };
  prompt_sections: PromptSection[];
}
