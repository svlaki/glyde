export interface DatabaseEvent {
  id: string;
  event_starts_at: string;
  event_ends_at: string;
  event_title: string;
  event_location?: string;
  event_description?: string;
  color?: string;
  recurrence?: any;
  embedding?: number[];
  event_created_at: string;
  event_updated_at: string;
  archetype?: string;
  archetype_data?: ArchetypeData;
}

export interface EventArchetype {
  id: string;
  name: string;
  description?: string;
  default_color: string;
  icon?: string;
  schema: any;
  created_at: string;
}

// Archetype-specific data structures
export interface WorkoutData {
  exercises?: Array<{
    name: string;
    sets: number;
    reps: number;
  }>;
}

export interface GroceryData {
  items?: Array<{
    item: string;
    quantity: string;
    completed: boolean;
  }>;
}

export interface MeetingData {
  attendees?: string[];
  agenda?: string;
  meeting_link?: string;
}

export interface AppointmentData {
  provider?: string;
  type?: string;
  location?: string;
}

export interface TravelData {
  destination?: string;
  departure_time?: string;
  transport?: string;
}

export interface PersonalData {
  notes?: string;
}

export interface WorkFocusData {
  tasks?: Array<{
    task: string;
    completed: boolean;
  }>;
}

export type ArchetypeData = WorkoutData | GroceryData | MeetingData | AppointmentData | TravelData | PersonalData | WorkFocusData | Record<string, any>;

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