import { AgentContext } from '../../../types/agents.js';
import { SupabaseService } from '../../../services/SupabaseService.js';
import { BaseAgent } from '../../base/BaseAgent.js';
import { InteractionCreationResult } from '../types.js';

/**
 * Context passed to each proactive strategy containing all necessary data and services.
 */
export interface StrategyContext {
  /** Agent context with user information */
  agentContext: AgentContext;

  /** User's timezone */
  timezone: string;

  /** User's calendar events */
  events: any[];

  /** User's tasks */
  tasks: any[];

  /** User's goals */
  goals: any[];

  /** Set of existing interaction keys to avoid duplicates */
  existingKeys: Set<string>;

  /** Maximum number of interactions this strategy can create */
  limit: number;

  /** Database service for creating interactions and querying data */
  supabaseService: SupabaseService;

  /** Base agent instance for memory persistence */
  baseAgent: BaseAgent;
}

/**
 * Abstract base class for all proactive suggestion strategies.
 * Each strategy focuses on a specific type of proactive suggestion.
 */
export abstract class ProactiveStrategy {
  /** Unique name for this strategy */
  abstract readonly name: string;

  /** Priority for execution order (higher = runs first) */
  abstract readonly priority: number;

  /**
   * Determines if this strategy should run based on the current context.
   *
   * @param context - Strategy context with all necessary data
   * @returns true if the strategy should execute, false to skip
   */
  abstract canRun(context: StrategyContext): boolean;

  /**
   * Executes the strategy to create proactive interactions.
   *
   * @param context - Strategy context with all necessary data
   * @returns Array of created interactions
   */
  abstract execute(context: StrategyContext): Promise<InteractionCreationResult[]>;
}
