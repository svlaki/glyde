import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseEvent, DatabaseChatMessage, DatabaseProfile, VectorSearchResult } from '../types/database.js';

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    this.client = createClient(supabaseUrl, supabaseKey);
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
    // Removed excessive logging
    
    // Use the vectorize-event Edge Function
    const { data, error } = await this.client.functions.invoke('vectorize-event', {
      body: {
        user_id: userId,
        event: event
      }
    });

    // Removed excessive logging

    if (error) {
      console.error('Error creating event:', error);
      // Don't throw immediately - try to recover
      return null;
    }

    if (data && !data.success) {
      console.error('Edge Function returned error:', data.error);
      return null;
    }

    // Return a basic event object since the Edge Function doesn't return the full event
    return {
      id: event.id || 'generated',
      event_title: event.event_title || '',
      event_starts_at: event.event_starts_at || '',
      event_ends_at: event.event_ends_at || '',
      event_location: event.event_location,
      event_description: event.event_description,
      event_created_at: new Date().toISOString(),
      event_updated_at: new Date().toISOString(),
      embedding: []
    };
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
    // Removed excessive logging
    
    // Use the chatHistory Edge Function
    const { data, error } = await this.client.functions.invoke('chatHistory', {
      body: {
        user_id: userId,
        session_id: sessionId
      }
    });

    // Removed excessive logging

    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }

    if (data && !data.success) {
      console.error('ChatHistory Edge Function returned error:', data.error);
      return [];
    }

    return data?.messages || [];
  }

  async addChatMessage(userId: string, message: Partial<DatabaseChatMessage>): Promise<DatabaseChatMessage | null> {
    // Removed excessive logging
    
    // Use the chat Edge Function
    const { data, error } = await this.client.functions.invoke('chat', {
      body: {
        user_id: userId,
        message: message.content,
        session_id: message.session_id,
        embedding: message.embedding
      }
    });

    // Removed excessive logging

    if (error) {
      console.error('Error adding chat message:', error);
      // Return null instead of throwing
      return null;
    }

    if (data && !data.success) {
      console.error('Chat Edge Function returned error:', data.error);
      return null;
    }

    // Return a basic message object since the Edge Function doesn't return the full message
    return {
      id: data?.id || 'generated',
      content: message.content || '',
      sender: message.sender || 'user',
      session_id: message.session_id || '',
      user_id: userId,
      timestamp: message.timestamp || new Date().toISOString(),
      embedding: message.embedding || []
    };
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