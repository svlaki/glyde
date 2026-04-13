/**
 * Configuration constants for the Gerald eval framework.
 */

import type { EvalConfig } from './types.js';

export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  userEmail: 'pc6176@stanford.edu',
  targetInteractionCount: 50,
  batchSize: 3,
  batchDelayMs: 2000,
  generationModel: 'gpt-5.1',
  judgeModel: 'gpt-4o',
  responseSimModel: 'gpt-4o-mini',
  outputDir: 'src/evals/gerald/reports',
};

export const SCORE_THRESHOLDS = {
  passingOverall: 3.5,
  passingGeneration: 3.0,
  passingResponse: 3.0,
  minimumDiversity: 0.5,
  minimumDedup: 0.85,
} as const;

export const INTERACTIONS_PER_INVOCATION = 2.5;

export const RESPONSE_DISTRIBUTION = {
  accept: 0.30,
  specific: 0.30,
  decline: 0.20,
  edge_case: 0.20,
} as const;
