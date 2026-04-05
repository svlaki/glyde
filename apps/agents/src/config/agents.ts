/**
 * Agent Configuration
 */

/**
 * Agent configuration options
 */
export const AGENT_CONFIG = {
  /**
   * Maximum number of pending interactions per user
   */
  maxPendingInteractions: 2,

  /**
   * Model to use for the interaction agent (Gerald)
   */
  model: 'gpt-5.4-mini',

  /**
   * Recursion limit for LangGraph
   */
  recursionLimit: 10,
};
