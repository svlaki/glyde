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

  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    console.log('🔍 [SUPABASE SERVICE] Fetching events for user:', userId);
    
    try {
      // Query the public events table with user_id filter
      let query = this.client
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: true });

      if (startDate) {
        query = query.gte('start_time', startDate);
      }
      if (endDate) {
        query = query.lte('start_time', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error fetching events:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return [];
      }

      console.log('✅ [SUPABASE SERVICE] Retrieved', data?.length || 0, 'events for user');
      console.log('🔍 [SUPABASE SERVICE] Raw event data:', JSON.stringify(data, null, 2));
      
      // Transform database response to match DatabaseEvent interface (map column names)
      const transformedEvents = (data || []).map((event: any) => ({
        id: event.id,
        event_title: event.title,  // Map title -> event_title
        event_starts_at: event.start_time,  // Map start_time -> event_starts_at
        event_ends_at: event.end_time,    // Map end_time -> event_ends_at
        event_location: event.location,   // Map location -> event_location
        event_description: event.description,  // Map description -> event_description
        event_created_at: event.created_at,    // Map created_at -> event_created_at
        event_updated_at: event.updated_at,    // Map updated_at -> event_updated_at
        color: event.color || '#3b82f6',
        archetype: event.archetype || 'generic',
        archetype_data: event.archetype_data || {}
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
      
      // Suggest archetype and get color from database
      const title = event.event_title || event.title || '';
      const description = event.event_description || event.description || '';
      
      // Auto-suggest archetype if not provided
      const suggestedArchetype = event.archetype || await this.suggestArchetype(title, description);
      
      // Get archetype color from database
      const color = await this.getArchetypeColor(suggestedArchetype, event.archetype_data || {});
      
      console.log(`🎨 [ARCHETYPE] Event "${title}" assigned archetype "${suggestedArchetype}" with color ${color}`);
      
      // Convert local time strings to proper UTC timestamps for database storage
      const convertLocalTimeToUTC = (localTimeString: string) => {
        if (!localTimeString) return localTimeString;
        
        // If timestamp already has timezone info, return as-is
        if (localTimeString.includes('Z') || localTimeString.includes('+') || localTimeString.includes('-', 19)) {
          return localTimeString;
        }
        
        // Create date object treating input as local time
        const localDate = new Date(localTimeString);
        const utcString = localDate.toISOString();
        console.log(`🌍 [TIMEZONE] Converting "${localTimeString}" (local) → "${utcString}" (UTC)`);
        // Return as ISO string (which will be UTC)
        return utcString;
      };
      
      // Create event directly in public events table  
      const eventData = {
        user_id: userId,
        title: event.event_title || (event as any).title || 'Untitled Event',
        description: event.event_description || (event as any).description || null,
        start_time: convertLocalTimeToUTC(event.event_starts_at || (event as any).start_time),
        end_time: convertLocalTimeToUTC(event.event_ends_at || (event as any).end_time),
        location: event.event_location || (event as any).location || null,
        color: color,
        archetype: suggestedArchetype,
        archetype_data: event.archetype_data || {}
      };
      
      console.log('🔍 [SUPABASE SERVICE] Creating event in public table:', eventData);

      const { data, error } = await this.client
        .from('events')
        .insert([eventData])
        .select()
        .single();

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
          event_title: data.title,  // Map title -> event_title
          event_starts_at: data.start_time,  // Map start_time -> event_starts_at
          event_ends_at: data.end_time,    // Map end_time -> event_ends_at
          event_location: data.location,   // Map location -> event_location
          event_description: data.description,  // Map description -> event_description
          event_created_at: data.created_at,    // Map created_at -> event_created_at
          event_updated_at: data.updated_at,    // Map updated_at -> event_updated_at
          color: data.color || color,
          archetype: data.archetype || suggestedArchetype,
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
      
      // Prepare update data for public events table
      const updateData: any = {};
      if (updates.event_title !== undefined) updateData.title = updates.event_title;
      if (updates.event_description !== undefined) updateData.description = updates.event_description;
      if (updates.event_starts_at !== undefined) updateData.start_time = updates.event_starts_at;
      if (updates.event_ends_at !== undefined) updateData.end_time = updates.event_ends_at;
      if (updates.event_location !== undefined) updateData.location = updates.event_location;
      if (updates.archetype !== undefined) updateData.archetype = updates.archetype;
      if (updates.archetype_data !== undefined) updateData.archetype_data = updates.archetype_data;
      
      // Update color based on archetype if archetype changed
      if (updates.archetype !== undefined) {
        const newColor = await this.getArchetypeColor(updates.archetype, updates.archetype_data || {});
        updateData.color = newColor;
      } else if (updates.color !== undefined) {
        updateData.color = updates.color;
      }
      
      const { data, error } = await this.client
        .from('events')
        .update(updateData)
        .eq('id', eventId)
        .eq('user_id', userId)
        .select()
        .single();

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
          event_title: data.title,  // Map title -> event_title
          event_starts_at: data.start_time,  // Map start_time -> event_starts_at
          event_ends_at: data.end_time,    // Map end_time -> event_ends_at
          event_location: data.location,   // Map location -> event_location
          event_description: data.description,  // Map description -> event_description
          event_created_at: data.created_at,    // Map created_at -> event_created_at
          event_updated_at: data.updated_at,    // Map updated_at -> event_updated_at
          color: data.color,
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
      
      const { error } = await this.client
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error deleting event:', error);
        console.error('❌ [SUPABASE SERVICE] Error details:', JSON.stringify(error, null, 2));
        return { success: false, error: error.message };
      }

      console.log('✅ [SUPABASE SERVICE] Event deleted successfully');
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