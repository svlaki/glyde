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
    const userSchema = this.getUserSchema(userId);
    console.log('🔍 [SUPABASE SERVICE] Fetching events from user schema:', userSchema);
    
    try {
      const { data, error } = await this.client
        .rpc('get_user_events', {
          user_schema: userSchema,
          start_date: startDate || null,
          end_date: endDate || null
        });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error fetching events:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return [];
      }

      console.log('✅ [SUPABASE SERVICE] Retrieved', data?.length || 0, 'events from user schema');
      console.log('🔍 [SUPABASE SERVICE] Raw event data:', JSON.stringify(data, null, 2));
      
      // Transform RPC response to match DatabaseEvent interface
      const transformedEvents = (data || []).map((event: any) => ({
        id: event.id,
        event_title: event.event_title,
        event_starts_at: event.event_starts_at,
        event_ends_at: event.event_ends_at,
        event_location: event.event_location,
        event_description: event.event_description,
        event_created_at: event.event_created_at,
        event_updated_at: event.event_updated_at,
        color: event.color || '#3b82f6'
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
      const userSchema = this.getUserSchema(userId);
      console.log('🔧 [SUPABASE SERVICE] Creating event in user schema:', userSchema);
      console.log('🔍 [SUPABASE SERVICE] Input event data:', JSON.stringify(event, null, 2));
      console.log('🔍 [SUPABASE SERVICE] User ID:', userId);
      
      // Use category-based colors
      const categoryColors: { [key: string]: string } = {
        work: '#3B82F6',      // Blue
        health: '#10B981',    // Green
        personal: '#8B5CF6',  // Purple
        learning: '#F59E0B',  // Orange
        finance: '#EF4444',   // Red
        travel: '#14B8A6',    // Teal
        routine: '#6366F1',   // Indigo
        social: '#EC4899'     // Pink
      };
      
      // Use provided category or determine from title/description
      let category = (event as any).category;
      
      if (!category) {
        // AI can intelligently assign category based on content
        const title = ((event.event_title || event.title || '')).toLowerCase();
        const description = ((event.event_description || event.description || '')).toLowerCase();
        const combined = title + ' ' + description;
        
        if (combined.match(/\b(meeting|standup|sync|call|interview|work|project|deadline|task)\b/)) {
          category = 'work';
        } else if (combined.match(/\b(gym|workout|exercise|doctor|health|medical|wellness)\b/)) {
          category = 'health';
        } else if (combined.match(/\b(friend|social|party|dinner|lunch|coffee|date)\b/)) {
          category = 'social';
        } else if (combined.match(/\b(course|class|study|learn|training|education)\b/)) {
          category = 'learning';
        } else if (combined.match(/\b(budget|payment|bill|finance|money|tax)\b/)) {
          category = 'finance';
        } else if (combined.match(/\b(travel|trip|flight|vacation|holiday)\b/)) {
          category = 'travel';
        } else if (combined.match(/\b(routine|daily|morning|evening|habit)\b/)) {
          category = 'routine';
        } else {
          category = 'personal';
        }
      }
      
      const color = categoryColors[category] || '#3B82F6';
      console.log(`📊 [CATEGORY] Event "${event.event_title}" categorized as ${category} with color ${color}`);
      
      // Use RPC function to create event in user schema
      const eventTitle = event.event_title || (event as any).title || 'Untitled Event';
      const eventDescription = event.event_description || (event as any).description || null;
      const eventStartsAt = event.event_starts_at || (event as any).start_time;
      const eventEndsAt = event.event_ends_at || (event as any).end_time;
      const eventLocation = event.event_location || (event as any).location || null;
      
      console.log('🔍 [SUPABASE SERVICE] Creating event with RPC function:', {
        user_schema: userSchema,
        event_title: eventTitle,
        event_starts_at: eventStartsAt,
        event_ends_at: eventEndsAt,
        event_location: eventLocation,
        event_description: eventDescription
      });

      const { data, error } = await this.client
        .rpc('create_user_event', {
          user_schema: userSchema,
          event_title: eventTitle,
          event_starts_at: eventStartsAt,
          event_ends_at: eventEndsAt,
          event_location: eventLocation,
          event_description: eventDescription,
          archetype: 'generic',
          archetype_data: { color, category },
          category: category,
          color: color
        });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error creating event:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return null;
      }

      console.log('✅ [SUPABASE SERVICE] Event created successfully:', JSON.stringify(data, null, 2));
      
      // Transform the response to match DatabaseEvent interface
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
          color: data.archetype_data?.color || color
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
      const userSchema = this.getUserSchema(userId);
      console.log('🔧 [SUPABASE SERVICE] Updating event in user schema:', userSchema);
      console.log('🔍 [SUPABASE SERVICE] Event ID:', eventId);
      console.log('🔍 [SUPABASE SERVICE] Updates:', JSON.stringify(updates, null, 2));
      
      const { data, error } = await this.client
        .rpc('update_user_event', {
          user_schema: userSchema,
          event_id: eventId,
          event_title: updates.event_title || null,
          event_description: updates.event_description || null,
          event_starts_at: updates.event_starts_at || null,
          event_ends_at: updates.event_ends_at || null,
          event_location: updates.event_location || null,
          archetype: null,
          archetype_data: null
        });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error updating event:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return null;
      }

      console.log('✅ [SUPABASE SERVICE] Event updated successfully:', JSON.stringify(data, null, 2));
      
      // Transform the response to match DatabaseEvent interface
      if (data) {
        return {
          id: data.id,
          event_title: data.event_title,
          event_starts_at: data.event_starts_at,
          event_ends_at: data.event_ends_at,
          event_location: data.event_location,
          event_description: data.event_description,
          event_created_at: data.event_created_at,
          event_updated_at: data.event_updated_at
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
      const userSchema = this.getUserSchema(userId);
      console.log('🗑️ [SUPABASE SERVICE] Deleting event from user schema:', userSchema);
      console.log('🔍 [SUPABASE SERVICE] Event ID:', eventId);
      
      const { data, error } = await this.client
        .rpc('delete_user_event', {
          user_schema: userSchema,
          event_id: eventId
        });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error deleting event:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return { success: false, error: error.message };
      }

      console.log('✅ [SUPABASE SERVICE] Event deleted successfully:', data);
      return { success: true, error: null };
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