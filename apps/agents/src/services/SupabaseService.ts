import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseEvent, DatabaseChatMessage, DatabaseProfile, VectorSearchResult } from '../types/database.js';
import { convertFromUTC, convertToUTC } from '../utils/timezoneUtils.js';

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

  // Helper method to convert UTC times to local display times (same as frontend does)
  private convertUTCToLocalDisplay(utcTimeString: string, timezone: string = 'America/New_York'): string {
    if (!utcTimeString) return utcTimeString;
    
    // Use the new timezone utilities for proper conversion
    return convertFromUTC(utcTimeString, timezone);
  }

  // Helper method to suggest archetype based on event title/description
  private async suggestArchetype(title: string, description: string = ''): Promise<string> {
    try {
      const { data, error } = await this.client.rpc('suggest_event_archetype', {
        event_title: title,
        event_description: description
      });

      if (error) {
        console.error('Error suggesting archetype:', error);
        return 'generic';
      }

      return data || 'generic';
    } catch (error) {
      console.error('Exception suggesting archetype:', error);
      return 'generic';
    }
  }

  // Helper method to get archetype color
  private async getArchetypeColor(archetype: string, archetypeData: any = {}): Promise<string> {
    try {
      const { data, error } = await this.client.rpc('get_event_archetype_color', {
        archetype_name: archetype,
        archetype_data: archetypeData
      });

      if (error) {
        console.error('Error getting archetype color:', error);
        return '#6B7280';
      }

      return data || '#6B7280';
    } catch (error) {
      console.error('Exception getting archetype color:', error);
      return '#6B7280';
    }
  }

  // Get all available archetypes
  async getArchetypes(): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('event_archetypes')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching archetypes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching archetypes:', error);
      return [];
    }
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

  // Method for agents - includes timezone conversion for proper local time display
  async getEventsForAgent(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    console.log('🔍 [SUPABASE SERVICE - AGENT] Fetching events for user:', userId);
    
    try {
      const userSchema = this.getUserSchema(userId);
      console.log('🏠 [SUPABASE SERVICE - AGENT] Using user schema:', userSchema);
      
      // Fetch user profile to get timezone
      const profile = await this.getProfile(userId);
      const userTimezone = profile?.timezone || 'America/New_York';
      console.log('🌍 [SUPABASE SERVICE - AGENT] Using user timezone:', userTimezone);
      
      // Use RPC function to get events from user's schema
      const { data, error } = await this.client.rpc('get_user_events', {
        user_schema: userSchema,
        start_date: startDate || null,
        end_date: endDate || null
      });

      if (error) {
        console.error('❌ [SUPABASE SERVICE - AGENT] Error fetching events:', error);
        return [];
      }

      console.log('✅ [SUPABASE SERVICE - AGENT] Retrieved', data?.length || 0, 'events for user');
      
      // Transform RPC response with timezone conversion for agent display
      const transformedEvents: DatabaseEvent[] = (data || []).map((eventJson: any) => ({
        id: eventJson.id,
        event_title: eventJson.event_title,
        event_starts_at: this.convertUTCToLocalDisplay(eventJson.event_starts_at, userTimezone),
        event_ends_at: this.convertUTCToLocalDisplay(eventJson.event_ends_at, userTimezone),
        event_location: eventJson.event_location,
        event_description: eventJson.event_description,
        event_created_at: eventJson.event_created_at,
        event_updated_at: eventJson.event_updated_at,
        color: eventJson.color || '#3b82f6',
        archetype: eventJson.archetype || 'generic',
        archetype_data: eventJson.archetype_data || {}
      }));
      
      console.log('🔄 [SUPABASE SERVICE - AGENT] Transformed events with timezone conversion:', JSON.stringify(transformedEvents, null, 2));
      return transformedEvents;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE - AGENT] Exception fetching events:', error);
      return [];
    }
  }

  // Method for frontend - no timezone conversion (frontend handles it)
  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    console.log('🔍 [SUPABASE SERVICE] Fetching events for user:', userId);
    
    try {
      const userSchema = this.getUserSchema(userId);
      console.log('🏠 [SUPABASE SERVICE] Using user schema:', userSchema);
      
      // Use RPC function to get events from user's schema
      const { data, error } = await this.client.rpc('get_user_events', {
        user_schema: userSchema,
        start_date: startDate || null,
        end_date: endDate || null
      });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error fetching events:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return [];
      }

      console.log('✅ [SUPABASE SERVICE] Retrieved', data?.length || 0, 'events for user');
      console.log('🔍 [SUPABASE SERVICE] Raw event data:', JSON.stringify(data, null, 2));
      
      // Transform RPC response to match DatabaseEvent interface (no timezone conversion for frontend)
      const transformedEvents: DatabaseEvent[] = (data || []).map((eventJson: any) => ({
        id: eventJson.id,
        event_title: eventJson.event_title,
        event_starts_at: eventJson.event_starts_at, // Frontend handles timezone conversion
        event_ends_at: eventJson.event_ends_at,     // Frontend handles timezone conversion
        event_location: eventJson.event_location,
        event_description: eventJson.event_description,
        event_created_at: eventJson.event_created_at,
        event_updated_at: eventJson.event_updated_at,
        color: eventJson.color || '#3b82f6',
        archetype: eventJson.archetype || 'generic',
        archetype_data: eventJson.archetype_data || {}
      }));
      
      console.log('🔄 [SUPABASE SERVICE] Transformed events for frontend:', JSON.stringify(transformedEvents, null, 2));
      return transformedEvents;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception fetching events:', error);
      return [];
    }
  }

  async createEvent(userId: string, event: Partial<DatabaseEvent> & {title?: string; description?: string; start_time?: string; end_time?: string; location?: string}): Promise<DatabaseEvent | null> {
    try {
      console.log('🔧 [SUPABASE SERVICE] Creating event for user:', userId);
      console.log('🔍 [SUPABASE SERVICE] Input event data:', JSON.stringify(event, null, 2));
      
      const userSchema = this.getUserSchema(userId);
      console.log('🏠 [SUPABASE SERVICE] Using user schema:', userSchema);
      
      // Fetch user profile to get timezone
      const profile = await this.getProfile(userId);
      const userTimezone = profile?.timezone || 'America/New_York';
      console.log('🌍 [SUPABASE SERVICE] Using user timezone:', userTimezone);
      
      // Extract event data
      const title = event.event_title || event.title || 'Untitled Event';
      const description = event.event_description || event.description || null;
      const location = event.event_location || event.location || null;
      const archetype = event.archetype || null;
      const archetypeData = event.archetype_data || {};
      
      // Convert local times to UTC using timezone utilities
      const startTime = convertToUTC(event.event_starts_at || (event as any).start_time, userTimezone);
      const endTime = convertToUTC(event.event_ends_at || (event as any).end_time, userTimezone);
      
      // Use RPC function to create event in user's schema
      const { data, error } = await this.client.rpc('create_user_event', {
        user_schema: userSchema,
        event_title: title,
        event_starts_at: startTime,
        event_ends_at: endTime,
        event_location: location,
        event_description: description,
        archetype: archetype,
        archetype_data: archetypeData
      });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error creating event:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return null;
      }

      console.log('✅ [SUPABASE SERVICE] Event created successfully:', JSON.stringify(data, null, 2));
      
      // Transform RPC response to match DatabaseEvent interface
      if (data) {
        return {
          id: data.id,
          event_title: data.event_title,
          event_starts_at: data.event_starts_at,
          event_ends_at: data.event_ends_at,
          event_location: data.event_location,
          event_description: data.event_description,
          event_created_at: data.event_created_at,
          event_updated_at: data.event_updated_at,
          color: data.color || '#3b82f6',
          archetype: data.archetype || 'generic',
          archetype_data: data.archetype_data || {}
        } as DatabaseEvent;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception creating event:', error);
      return null;
    }
  }

  async updateEvent(userId: string, eventId: string, updates: Partial<DatabaseEvent>): Promise<DatabaseEvent | null> {
    try {
      console.log('🔧 [SUPABASE SERVICE] Updating event for user:', userId);
      console.log('🔍 [SUPABASE SERVICE] Event ID:', eventId);
      console.log('🔍 [SUPABASE SERVICE] Updates:', JSON.stringify(updates, null, 2));
      
      const userSchema = this.getUserSchema(userId);
      console.log('🏠 [SUPABASE SERVICE] Using user schema:', userSchema);
      
      // Use RPC function to update event in user's schema
      const { data, error } = await this.client.rpc('update_user_event', {
        user_schema: userSchema,
        event_id: eventId,
        event_title: updates.event_title || null,
        event_starts_at: updates.event_starts_at || null,
        event_ends_at: updates.event_ends_at || null,
        event_location: updates.event_location || null,
        event_description: updates.event_description || null,
        archetype: updates.archetype || null,
        archetype_data: updates.archetype_data || null
      });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error updating event:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return null;
      }

      console.log('✅ [SUPABASE SERVICE] Event updated successfully:', JSON.stringify(data, null, 2));
      
      // Transform RPC response to match DatabaseEvent interface
      if (data) {
        return {
          id: data.id,
          event_title: data.event_title,
          event_starts_at: data.event_starts_at,
          event_ends_at: data.event_ends_at,
          event_location: data.event_location,
          event_description: data.event_description,
          event_created_at: data.event_created_at,
          event_updated_at: data.event_updated_at,
          color: data.color || '#3b82f6',
          archetype: data.archetype || 'generic',
          archetype_data: data.archetype_data || {}
        } as DatabaseEvent;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception updating event:', error);
      return null;
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<{ success: boolean, error: string | null }> {
    try {
      console.log('🗑️ [SUPABASE SERVICE] Deleting event for user:', userId);
      console.log('🔍 [SUPABASE SERVICE] Event ID:', eventId);
      
      const userSchema = this.getUserSchema(userId);
      console.log('🏠 [SUPABASE SERVICE] Using user schema:', userSchema);
      
      // Use RPC function to delete event from user's schema
      const { data, error } = await this.client.rpc('delete_user_event', {
        user_schema: userSchema,
        event_id: eventId
      });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error deleting event:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return { success: false, error: error.message };
      }

      // RPC function returns boolean indicating success
      const success = data === true;
      console.log('✅ [SUPABASE SERVICE] Event deletion result:', success);
      return { success, error: success ? null : 'Event not found or could not be deleted' };
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception deleting event:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
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
      match_count: limit 
    });
    
    const { data, error } = await this.client
      .rpc('match_events', {
        query_embedding: queryEmbedding,
        match_count: limit,
        filter: { user_schema: schema }
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
        match_count: limit,
        filter: { user_schema: schema }
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