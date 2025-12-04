/**
 * Agent Configuration
 *
 * This file allows easy swapping of agent implementations.
 * To change which interaction agent is used, simply change the ACTIVE_INTERACTION_AGENT value.
 */

/**
 * Available interaction agent variants
 */
export type InteractionAgentVariant = 'default' | 'gerald';

/**
 * The currently active interaction agent.
 *
 * Options:
 * - 'default': Original InteractionAgent (yes/no suggestions, event scheduling only)
 * - 'gerald': Enhanced InteractionAgentGerald (multiple types, tasks/events/goals, follow-ups)
 *
 * To switch agents, simply change this value and restart the server.
 */
export const ACTIVE_INTERACTION_AGENT: InteractionAgentVariant = 'gerald';

/**
 * Agent configuration options
 */
export const AGENT_CONFIG = {
  /**
   * Maximum number of pending interactions per user
   */
  maxPendingInteractions: 2,

  /**
   * Model to use for each agent variant
   */
  models: {
    default: 'gpt-5.1',
    gerald: 'gpt-5.1',
  },

  /**
   * Recursion limits for LangGraph
   */
  recursionLimits: {
    default: 4,
    gerald: 6,
  },
};
