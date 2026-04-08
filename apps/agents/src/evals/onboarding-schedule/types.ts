/**
 * Type definitions for the onboarding-to-schedule pipeline eval.
 */

export interface CharacterSheet {
  readonly id: string;
  readonly name: string;
  readonly onboardingData: OnboardingDataV2;
  readonly personality: string;
  readonly enrichmentDetails: readonly string[];
  readonly conversationScenarios: readonly ConversationScenario[];
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

/**
 * A scenario the character would realistically ask the ConversationAgent after enrichment.
 * Each scenario tests a specific behavior pattern.
 */
export interface ConversationScenario {
  readonly id: string;
  readonly category: ScenarioCategory;
  readonly userMessage: string;
  readonly description: string;
  readonly expectedBehavior: ExpectedBehavior;
}

export type ScenarioCategory =
  | 'schedule-query'       // "what do i have today"
  | 'event-create'         // "add a meeting friday at 3"
  | 'event-modify'         // "move my 2pm to 3pm"
  | 'event-delete'         // "cancel my meeting tomorrow"
  | 'task-management'      // "remind me to buy groceries"
  | 'goal-checkin'         // "how am i doing on my goals"
  | 'suggestion-interact'  // "what should i work on next"
  | 'context-awareness'    // "do i have time for coffee tomorrow"
  | 'duplicate-avoidance'  // creating something that already exists
  | 'edge-case';           // ambiguous or tricky requests

export interface ExpectedBehavior {
  readonly shouldCallTools: readonly string[];
  readonly shouldNotCallTools?: readonly string[];
  readonly responseShould: readonly string[];
  readonly responseShouldNot?: readonly string[];
}

export interface ToolCallDetail {
  readonly name: string;
  readonly args: Record<string, any>;
  readonly result?: string;
}

export interface OnboardingScheduleEvalConfig {
  readonly characters: readonly string[];
  readonly enrichmentTurns: number;
  readonly conversationEnabled: boolean;
  readonly simulatorModel: string;
  readonly judgeModel: string;
  readonly outputDir: string;
}

export interface EnrichmentTurn {
  readonly turnNumber: number;
  readonly userMessage: string;
  readonly agentResponse: string;
  readonly toolsCalled: readonly string[];
  readonly toolDetails: readonly ToolCallDetail[];
}

export interface ConversationTurn {
  readonly scenarioId: string;
  readonly category: ScenarioCategory;
  readonly userMessage: string;
  readonly agentResponse: string;
  readonly toolsCalled: readonly string[];
  readonly toolDetails: readonly ToolCallDetail[];
  readonly durationMs: number;
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

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly modelCalls: number;
}

export interface PipelineResult {
  readonly character: CharacterSheet;
  readonly testUserId: string;
  readonly onboardingDurationMs: number;
  readonly enrichmentConversation: readonly EnrichmentTurn[];
  readonly enrichmentDurationMs: number;
  readonly schedulerDurationMs: number;
  readonly conversationTurns: readonly ConversationTurn[];
  readonly conversationDurationMs: number;
  readonly finalState: FinalState;
  readonly toolUsageSummary: Record<string, number>;
  readonly tokenUsage: TokenUsage;
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

export interface ConversationBehaviorScore {
  readonly toolCorrectness: number;
  readonly responseAccuracy: number;
  readonly duplicateAvoidance: number;
  readonly contextAwareness: number;
  readonly overall: number;
  readonly reasoning: string;
  readonly scenarioResults: readonly ScenarioResult[];
}

export interface ScenarioResult {
  readonly scenarioId: string;
  readonly category: ScenarioCategory;
  readonly passed: boolean;
  readonly toolsExpected: readonly string[];
  readonly toolsActual: readonly string[];
  readonly violations: readonly string[];
}

export interface PersonaEvalResult {
  readonly characterId: string;
  readonly enrichmentScore: EnrichmentScore;
  readonly scheduleScore: ScheduleScore;
  readonly conversationScore: ConversationBehaviorScore;
  readonly pipelineResult: PipelineResult;
  readonly passFail: 'PASS' | 'FAIL';
}

export interface EvalReport {
  readonly timestamp: string;
  readonly config: OnboardingScheduleEvalConfig;
  readonly results: readonly PersonaEvalResult[];
  readonly behaviorCriteria: readonly string[];
  readonly summary: {
    readonly totalPersonas: number;
    readonly passed: number;
    readonly failed: number;
    readonly avgEnrichmentScore: number;
    readonly avgScheduleScore: number;
    readonly avgConversationScore: number;
    readonly avgOverallScore: number;
    readonly totalToolCalls: number;
    readonly toolBreakdown: Record<string, number>;
  };
}

export interface TestUser {
  readonly userId: string;
  readonly cleanup: () => Promise<void>;
}
