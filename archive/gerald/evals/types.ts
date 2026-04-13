/**
 * Type definitions for the Gerald interaction quality evaluation framework.
 */

export interface EvalConfig {
  readonly userEmail: string;
  readonly targetInteractionCount: number;
  readonly batchSize: number;
  readonly batchDelayMs: number;
  readonly generationModel: string;
  readonly judgeModel: string;
  readonly responseSimModel: string;
  readonly outputDir: string;
}

export interface LoadedUserData {
  readonly userId: string;
  readonly profile: Record<string, any>;
  readonly events: readonly Record<string, any>[];
  readonly tasks: readonly Record<string, any>[];
  readonly goals: readonly Record<string, any>[];
  readonly aspects: readonly Record<string, any>[];
  readonly recentInteractions: readonly Record<string, any>[];
  readonly ratingSummary: readonly RatingSummaryEntry[];
  readonly rules: readonly Record<string, any>[];
  readonly recentPastEvents: readonly Record<string, any>[];
}

export interface RatingSummaryEntry {
  readonly topic: string;
  readonly latestScore: number;
  readonly trend: number;
  readonly lastAsked: string;
  readonly totalEntries: number;
}

export type InteractionType = 'yes_no' | 'multiple_choice' | 'text' | 'rating' | 'time_suggestion';

export interface GeneratedInteraction {
  readonly index: number;
  readonly batchNumber: number;
  readonly question: string;
  readonly type: InteractionType;
  readonly options?: readonly string[];
  readonly priority: number;
  readonly aspectId?: string;
  readonly metadata?: Record<string, any>;
}

export type ResponseCategory = 'accept' | 'decline' | 'specific' | 'edge_case';

export interface SimulatedResponse {
  readonly interactionIndex: number;
  readonly responseText: string;
  readonly responseCategory: ResponseCategory;
}

export interface CapturedToolCall {
  readonly name: string;
  readonly args: Record<string, any>;
}

export interface ResponseProcessingResult {
  readonly interactionIndex: number;
  readonly simulatedResponse: SimulatedResponse;
  readonly toolCalls: readonly CapturedToolCall[];
  readonly rawResponse: string;
}

export interface InteractionScore {
  readonly contextRelevance: number;
  readonly specificity: number;
  readonly appropriateness: number;
  readonly metadataQuality: number;
  readonly overall: number;
  readonly reasoning: string;
}

export interface ResponseScore {
  readonly actionCorrectness: number;
  readonly toolSelection: number;
  readonly minimalAction: number;
  readonly overall: number;
  readonly reasoning: string;
}

export interface EvalResult {
  readonly interaction: GeneratedInteraction;
  readonly interactionScore: InteractionScore;
  readonly response: SimulatedResponse;
  readonly responseProcessing: ResponseProcessingResult;
  readonly responseScore: ResponseScore;
}

export interface EvalReport {
  readonly timestamp: string;
  readonly config: EvalConfig;
  readonly userData: {
    readonly userId: string;
    readonly email: string;
    readonly timezone: string;
    readonly displayName: string;
  };
  readonly summary: {
    readonly totalInteractions: number;
    readonly overallScore: number;
    readonly generationScore: number;
    readonly responseScore: number;
    readonly passFail: 'PASS' | 'FAIL';
  };
  readonly typeDistribution: Record<string, number>;
  readonly aspectCoverage: number;
  readonly topicDiversity: number;
  readonly results: readonly EvalResult[];
  readonly topInteractions: readonly EvalResult[];
  readonly bottomInteractions: readonly EvalResult[];
  readonly toolUsageSummary: Record<string, number>;
}
