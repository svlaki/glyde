export interface TimeSlot {
  startLocal: Date;
  endLocal: Date;
}

export interface InteractionCreationResult {
  id?: string;
  question: string;
  metadata?: Record<string, any> | null;
}

export type ProactiveCommand =
  | { command: 'generate_interactions'; manual?: boolean }
  | { command: 'handle_response'; interactionId: string; response: string; interaction?: any };
