export type SuggestionType = 'goal_step' | 'task_step' | 'prep_step' | 'habit' | 'general';
export type SuggestionStatus = 'open' | 'snoozed' | 'completed' | 'archived';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type SourceEntityType = 'goal' | 'task' | 'event' | 'aspect';
export type SlotStatus = 'proposed' | 'edited' | 'confirmed' | 'dismissed' | 'expired';
export type FeedbackType = 'confirm' | 'dismiss' | 'swap' | 'resize' | 'drag';

export interface ActionSuggestion {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  suggestion_type: SuggestionType;
  source_entity_type?: SourceEntityType;
  source_entity_id?: string;
  aspect_id?: string;
  estimated_minutes?: number;
  energy_level?: EnergyLevel;
  status: SuggestionStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlacementSlot {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  suggestion_id: string;
  status: SlotStatus;
  source_agent?: string;
  reasoning?: string;
  expires_at?: string;
  confirmed_event_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SlotWithSuggestion extends PlacementSlot {
  suggestion_title: string;
  suggestion_description?: string;
  suggestion_type: SuggestionType;
  estimated_minutes?: number;
  energy_level?: EnergyLevel;
  aspect_id?: string;
  aspect_name?: string;
  aspect_color?: string;
  aspect_icon?: string;
}

export interface SlotFeedback {
  id: string;
  user_id: string;
  slot_id: string;
  suggestion_id?: string;
  feedback_type: FeedbackType;
  reason?: string;
  created_at: string;
}

// API request types

export interface CreateSuggestionRequest {
  title: string;
  description?: string;
  suggestion_type: SuggestionType;
  source_entity_type?: SourceEntityType;
  source_entity_id?: string;
  aspect_id?: string;
  estimated_minutes?: number;
  energy_level?: EnergyLevel;
  metadata?: Record<string, unknown>;
}

export interface UpdateSuggestionRequest {
  suggestion_id: string;
  title?: string;
  description?: string;
  status?: SuggestionStatus;
  estimated_minutes?: number;
  energy_level?: EnergyLevel;
  aspect_id?: string;
}

export interface CreateSlotRequest {
  start_time: string;
  end_time: string;
  suggestion_id: string;
  source_agent?: string;
  reasoning?: string;
  expires_at?: string;
}

export interface MoveSlotRequest {
  slot_id: string;
  start_time: string;
  end_time: string;
}

export interface ResizeSlotRequest {
  slot_id: string;
  end_time: string;
}

export interface SwapSlotRequest {
  slot_id: string;
}

export interface ConfirmSlotRequest {
  slot_id: string;
}

export interface DismissSlotRequest {
  slot_id: string;
  reason?: string;
}

export interface ListSlotsRequest {
  start_date: string;
  end_date: string;
}

export interface ListSuggestionsRequest {
  status?: SuggestionStatus;
  aspect_id?: string;
}
