/**
 * Configuration for the onboarding-to-schedule pipeline eval.
 */

import type { OnboardingScheduleEvalConfig } from './types.js';

export const DEFAULT_EVAL_CONFIG: OnboardingScheduleEvalConfig = {
  characters: ['all'],
  enrichmentTurns: 10,
  conversationEnabled: true,
  simulatorModel: 'gpt-5.4-nano',
  judgeModel: 'gpt-5.4-nano',
  outputDir: 'src/evals/onboarding-schedule/reports',
};

export const SCORE_THRESHOLDS = {
  passingEnrichment: 3.5,
  passingSchedule: 3.5,
  passingOverall: 3.5,
  minAspectsCaptured: 0.6,
  minEventsCreated: 3,
} as const;
