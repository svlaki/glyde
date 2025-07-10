export interface DatabaseEvent {
  id: string;
  event_starts_at: string;
  event_ends_at: string;
  event_title: string;
  event_location?: string;
  event_description?: string;
  recurrence?: any;
  embedding?: number[];
  event_created_at: string;
  event_updated_at: string;
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