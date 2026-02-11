export interface DatabaseEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  aspect?: string;  // For backward compatibility
  created_at: string;
  updated_at: string;

  // Extended aspect fields (populated by get_events_with_aspects RPC)
  aspect_id?: string;
  aspect_name?: string;
  aspect_color?: string;
  aspect_icon?: string;

  // Recurring event fields
  recurrence_rule?: string;  // RFC 5545 RRULE format
  recurrence_end?: string;  // Optional recurrence end date
  parent_event_id?: string;  // Links instances to parent recurring event
  is_recurring?: boolean;  // Quick flag for recurring events
  is_instance?: boolean;  // Flag for event instances of a recurring series
  instance_date?: string;  // YYYY-MM-DD date for this specific instance
  visibility?: 'private' | 'friends' | 'public';  // Event visibility setting

  // Post-event metadata
  reflection?: string;  // User's reflection on what happened during the event
  is_missed?: boolean;  // Whether the user missed/did not attend this event

  // Shared aspect flag
  is_shared?: boolean;  // True if item comes from a shared aspect (not owned by this user)
}

export interface DatabaseAspect {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  context?: Record<string, any>;
  display_order?: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  embedding?: number[];
  role: 'user' | 'assistant';
  created_at: string;
}

export interface DatabaseProfile {
  id: string;
  email: string;
  display_name?: string;
  preferred_name?: string;
  avatar_url?: string;
  timezone?: string;
  values?: Record<string, any>;
  preferences?: Record<string, any>;
  work_patterns?: Record<string, any>;
  goals_summary?: string;
  personality_traits?: Record<string, any>;
  context_data?: Record<string, any>;
  birthday?: string;
  gender?: string;
  habits?: any[];
  field_of_study?: string;
  occupation?: string;
  force_reauth?: boolean;
  created_at: string;
}

export interface DatabaseSettings {
  key: string;
  value: any;
}

export interface VectorSearchResult<T> {
  data: T;
  similarity: number;
}

export interface UserSchema {
  userId: string;
  schemaName: string;
}