export interface DatabaseEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  category?: string;  // For backward compatibility
  created_at: string;
  updated_at: string;

  // Extended category fields (populated by get_events_with_categories RPC)
  category_id?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;

  // Recurring event fields
  recurrence_rule?: string;  // RFC 5545 RRULE format
  recurrence_end?: string;  // Optional recurrence end date
  parent_event_id?: string;  // Links instances to parent recurring event
  is_recurring?: boolean;  // Quick flag for recurring events
  is_instance?: boolean;  // Flag for event instances of a recurring series
  instance_date?: string;  // YYYY-MM-DD date for this specific instance
}

export interface DatabaseCategory {
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
  sender: 'user' | 'assistant';
  timestamp: string;
}

export interface DatabaseProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
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