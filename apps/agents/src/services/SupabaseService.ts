import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseEvent, DatabaseChatMessage, DatabaseProfile, VectorSearchResult } from '../types/database.js';

// Export supabase client for use in other modules
export let supabase: SupabaseClient;

// Initialize supabase client
export function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
}

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    if (!supabase) {
      initializeSupabase();
    }
    this.client = supabase;
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  private getUserSchema(userId: string): string {
    return `u_${userId.replace(/-/g, '')}`;
  }

  async getProfile(userId: string): Promise<DatabaseProfile | null> {
    const { data, error } = await this.client
      .from('profile')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  }

  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    const schema = this.getUserSchema(userId);
    
    const { data, error } = await this.client
      .rpc('get_user_events', {
        user_schema: schema,
        start_date: startDate || null,
        end_date: endDate || null
      });

    if (error) {
      console.error('Error fetching events:', error);
      return [];
    }

    return data || [];
  }

  async createEvent(userId: string, event: Partial<DatabaseEvent>): Promise<DatabaseEvent | null> {
    try {
      const response = await fetch('http://localhost:8000/api/embeddings/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          event: event
        })
      });

      const data = await response.json() as { 
        success: boolean; 
        event?: DatabaseEvent; 
        error?: string; 
      };

      if (!response.ok) {
        console.error('Error creating event:', data.error);
        return null;
      }

      if (!data.success) {
        console.error('Event creation failed:', data.error);
        return null;
      }

      return data.event || null;
    } catch (error) {
      console.error('Error creating event:', error);
      return null;
    }
  }

  async updateEvent(userId: string, eventId: string, updates: Partial<DatabaseEvent>): Promise<DatabaseEvent | null> {
    const schema = this.getUserSchema(userId);
    
    const { data, error } = await this.client.rpc('update_user_event', {
      user_schema: schema,
      event_id: eventId,
      event_title: updates.event_title,
      event_starts_at: updates.event_starts_at,
      event_ends_at: updates.event_ends_at,
      event_location: updates.event_location,
      event_description: updates.event_description
    });

    if (error) {
      console.error('Error updating event:', error);
      return null;
    }

    return data;
  }

  async deleteEvent(userId: string, eventId: string): Promise<{ success: boolean, error: string | null }> {
    const schema = this.getUserSchema(userId);
    
    const { data, error } = await this.client.rpc('delete_user_event', {
      user_schema: schema,
      event_id: eventId
    });

    if (error) {
      console.error('Error deleting event:', error);
      return { success: false, error: error.message };
    }

    return { success: data, error: null };
  }

  async getChatMessages(userId: string, sessionId: string, limit: number = 50): Promise<DatabaseChatMessage[]> {
    try {
      const response = await fetch('http://localhost:8000/api/chat/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId,
          limit: limit
        })
      });

      const data = await response.json() as { 
        success?: boolean; 
        messages?: DatabaseChatMessage[]; 
        error?: string; 
      };

      if (!response.ok) {
        console.error('Error fetching chat messages:', data.error);
        return [];
      }

      return data.messages || [];
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
  }

  async addChatMessage(userId: string, message: Partial<DatabaseChatMessage>): Promise<DatabaseChatMessage | null> {
    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          message: message.content,
          session_id: message.session_id,
          sender: message.sender,
          embedding: message.embedding
        })
      });

      const data = await response.json() as { 
        success?: boolean; 
        message?: DatabaseChatMessage; 
        error?: string; 
      };

      if (!response.ok) {
        console.error('Error adding chat message:', data.error);
        return null;
      }

      return data.message || null;
    } catch (error) {
      console.error('Error adding chat message:', error);
      return null;
    }
  }

  async searchSimilarEvents(userId: string, queryEmbedding: number[], limit: number = 10): Promise<VectorSearchResult<DatabaseEvent>[]> {
    const schema = this.getUserSchema(userId);
    
    console.log('🔍 DEBUG: Calling match_events with:', { 
      schema, 
      embedding_length: queryEmbedding.length, 
      match_threshold: 0.3, 
      match_count: limit 
    });
    
    const { data, error } = await this.client
      .rpc('match_events', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3, // Lower threshold for better matches
        match_count: limit,
        user_schema: schema
      });

    if (error) {
      console.error('Error searching similar events:', error);
      return [];
    }

    return data || [];
  }

  async searchSimilarChats(userId: string, queryEmbedding: number[], limit: number = 10): Promise<VectorSearchResult<DatabaseChatMessage>[]> {
    const schema = this.getUserSchema(userId);
    
    const { data, error } = await this.client
      .rpc('match_chat_messages', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: limit,
        user_schema: schema
      });

    if (error) {
      console.error('Error searching similar chats:', error);
      return [];
    }

    return data || [];
  }

  async getUserSettings(userId: string): Promise<Record<string, any>> {
    const schema = this.getUserSchema(userId);
    
    const { data, error } = await this.client
      .schema(schema)
      .from('settings')
      .select('*');

    if (error) {
      console.error('Error fetching settings:', error);
      return {};
    }

    const settings: Record<string, any> = {};
    data?.forEach(setting => {
      settings[setting.key] = setting.value;
    });

    return settings;
  }

  async updateUserSetting(userId: string, key: string, value: any): Promise<boolean> {
    const schema = this.getUserSchema(userId);
    
    const { error } = await this.client
      .schema(schema)
      .from('settings')
      .upsert([{ key, value }]);

    if (error) {
      console.error('Error updating setting:', error);
      return false;
    }

    return true;
  }

  async subscribeToUserChanges(userId: string, callback: (payload: any) => void) {
    const schema = this.getUserSchema(userId);
    
    return this.client
      .channel(`user_changes_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: schema,
        table: 'events'
      }, callback)
      .on('postgres_changes', {
        event: '*',
        schema: schema,
        table: 'chat_messages'
      }, callback)
      .subscribe();
  }
}