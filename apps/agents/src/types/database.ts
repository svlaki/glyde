export interface DatabaseEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  category?: string;
  created_at: string;
  updated_at: string;
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