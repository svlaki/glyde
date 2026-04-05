/**
 * Type definitions for the onboarding-to-schedule pipeline eval.
 */

export interface CharacterSheet {
  readonly id: string;
  readonly name: string;
  readonly onboardingData: OnboardingDataV2;
  readonly personality: string;
  readonly enrichmentDetails: readonly string[];
  readonly expectedOutcomes: {
    readonly minAspects: number;
    readonly minRecurringEvents: number;
    readonly minGoals: number;
    readonly expectedAspectNames: readonly string[];
    readonly expectedSchedulePatterns: readonly string[];
  };
}

export interface OnboardingDataV2 {
  readonly fullName: string;
  readonly preferredName?: string;
  readonly birthday: string;
  readonly selectedCalendars: readonly string[];
  readonly otherCalendar?: string;
  readonly occupation: string;
  readonly fieldOfStudy?: string;
  readonly aspects: readonly string[];
  readonly goals: readonly string[];
  readonly timezone: string;
}

export interface OnboardingScheduleEvalConfig {
  readonly characters: readonly string[];
  readonly enrichmentTurns: number;
  readonly simulatorModel: string;
  readonly judgeModel: string;
  readonly outputDir: string;
}

export interface EnrichmentTurn {
  readonly turnNumber: number;
  readonly userMessage: string;
  readonly agentResponse: string;
  readonly toolsCalled: readonly string[];
}

export interface FinalState {
  readonly aspects: readonly Record<string, any>[];
  readonly events: readonly Record<string, any>[];
  readonly recurringEvents: readonly Record<string, any>[];
  readonly tasks: readonly Record<string, any>[];
  readonly goals: readonly Record<string, any>[];
  readonly suggestions: readonly Record<string, any>[];
  readonly placementSlots: readonly Record<string, any>[];
}

export interface PipelineResult {
  readonly character: CharacterSheet;
  readonly testUserId: string;
  readonly onboardingDurationMs: number;
  readonly enrichmentConversation: readonly EnrichmentTurn[];
  readonly enrichmentDurationMs: number;
  readonly schedulerDurationMs: number;
  readonly finalState: FinalState;
}

export interface EnrichmentScore {
  readonly aspectDiscovery: number;
  readonly scheduleCapture: number;
  readonly goalExtraction: number;
  readonly conversationQuality: number;
  readonly overall: number;
  readonly reasoning: string;
}

export interface ScheduleScore {
  readonly suggestionRelevance: number;
  readonly scheduleCompleteness: number;
  readonly timeSlotQuality: number;
  readonly aspectBalance: number;
  readonly descriptionQuality: number;
  readonly overall: number;
  readonly reasoning: string;
}

export interface PersonaEvalResult {
  readonly characterId: string;
  readonly enrichmentScore: EnrichmentScore;
  readonly scheduleScore: ScheduleScore;
  readonly pipelineResult: PipelineResult;
  readonly passFail: 'PASS' | 'FAIL';
}

export interface EvalReport {
  readonly timestamp: string;
  readonly config: OnboardingScheduleEvalConfig;
  readonly results: readonly PersonaEvalResult[];
  readonly summary: {
    readonly totalPersonas: number;
    readonly passed: number;
    readonly failed: number;
    readonly avgEnrichmentScore: number;
    readonly avgScheduleScore: number;
    readonly avgOverallScore: number;
  };
}

export interface TestUser {
  readonly userId: string;
  readonly cleanup: () => Promise<void>;
}
