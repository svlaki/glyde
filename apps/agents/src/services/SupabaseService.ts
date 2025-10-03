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
      
      console.log('🔄 [SUPABASE SERVICE - AGENT] Transformed', transformedEvents.length, 'events with timezone conversion');
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
      
      console.log('🔄 [SUPABASE SERVICE] Transformed', transformedEvents.length, 'events for frontend');
      return transformedEvents;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception fetching events:', error);
      return [];
    }
  }

  async createEvent(userId: string, event: Partial<DatabaseEvent> & {title?: string; description?: string; start_time?: string; end_time?: string; location?: string; category?: string}): Promise<DatabaseEvent | null> {
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
      const category = (event as any).category || 'Personal';
      
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
        category: category
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
          category: data.category || 'Personal'
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
        category: updates.category || null
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

  // ============================================================================
  // TASK MANAGEMENT METHODS
  // ============================================================================

  /**
   * Create a new task in the user's schema
   */
  async createTask(userId: string, taskData: {
    title: string;
    description?: string;
    category?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    parentGoalId?: string;
    color?: string;
    energyRequired?: 'low' | 'medium' | 'high';
    estimatedDuration?: number;
    contextRequired?: Record<string, any>;
    recurringPattern?: Record<string, any>;
    taskMetadata?: Record<string, any>;
  }): Promise<any> {
    try {
      console.log('📝 [SUPABASE SERVICE] Creating task for user:', userId);
      const userSchema = this.getUserSchema(userId);

      const { data, error } = await this.client
        .schema(userSchema)
        .from('tasks')
        .insert({
          user_id: userId,
          title: taskData.title,
          description: taskData.description,
          category: taskData.category || 'personal',
          due_date: taskData.dueDate,
          priority: taskData.priority || 'medium',
          status: taskData.status || 'pending',
          parent_goal_id: taskData.parentGoalId,
          color: taskData.color,
          energy_required: taskData.energyRequired,
          estimated_duration: taskData.estimatedDuration,
          context_required: taskData.contextRequired || {},
          recurring_pattern: taskData.recurringPattern || {},
          task_metadata: taskData.taskMetadata || {}
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error creating task:', error);
        throw error;
      }

      console.log('✅ [SUPABASE SERVICE] Task created:', data.id);
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception creating task:', error);
      throw error;
    }
  }

  /**
   * Get tasks for a user with optional filters
   */
  async getTasks(userId: string, filters?: {
    status?: string;
    category?: string;
    priority?: string;
    parentGoalId?: string;
    dueBefore?: string;
    dueAfter?: string;
  }): Promise<any[]> {
    try {
      console.log('🔍 [SUPABASE SERVICE] Getting tasks for user:', userId);
      const userSchema = this.getUserSchema(userId);

      let query = this.client
        .schema(userSchema)
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.parentGoalId) {
        query = query.eq('parent_goal_id', filters.parentGoalId);
      }
      if (filters?.dueBefore) {
        query = query.lte('due_date', filters.dueBefore);
      }
      if (filters?.dueAfter) {
        query = query.gte('due_date', filters.dueAfter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error getting tasks:', error);
        return [];
      }

      console.log(`✅ [SUPABASE SERVICE] Found ${data?.length || 0} tasks`);
      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception getting tasks:', error);
      return [];
    }
  }

  /**
   * Update a task
   */
  async updateTask(userId: string, taskId: string, updates: {
    title?: string;
    description?: string;
    category?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    parentGoalId?: string;
    color?: string;
    energyRequired?: 'low' | 'medium' | 'high';
    estimatedDuration?: number;
    actualDuration?: number;
    contextRequired?: Record<string, any>;
    completionNotes?: string;
    recurringPattern?: Record<string, any>;
    taskMetadata?: Record<string, any>;
  }): Promise<any> {
    try {
      console.log('🔄 [SUPABASE SERVICE] Updating task:', taskId);
      const userSchema = this.getUserSchema(userId);

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }
      }
      if (updates.parentGoalId !== undefined) updateData.parent_goal_id = updates.parentGoalId;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.energyRequired !== undefined) updateData.energy_required = updates.energyRequired;
      if (updates.estimatedDuration !== undefined) updateData.estimated_duration = updates.estimatedDuration;
      if (updates.actualDuration !== undefined) updateData.actual_duration = updates.actualDuration;
      if (updates.contextRequired !== undefined) updateData.context_required = updates.contextRequired;
      if (updates.completionNotes !== undefined) updateData.completion_notes = updates.completionNotes;
      if (updates.recurringPattern !== undefined) updateData.recurring_pattern = updates.recurringPattern;
      if (updates.taskMetadata !== undefined) updateData.task_metadata = updates.taskMetadata;

      const { data, error } = await this.client
        .schema(userSchema)
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error updating task:', error);
        throw error;
      }

      console.log('✅ [SUPABASE SERVICE] Task updated:', taskId);
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception updating task:', error);
      throw error;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(userId: string, taskId: string): Promise<{ success: boolean, error: string | null }> {
    try {
      console.log('🗑️ [SUPABASE SERVICE] Deleting task:', taskId);
      const userSchema = this.getUserSchema(userId);

      const { error } = await this.client
        .schema(userSchema)
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error deleting task:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [SUPABASE SERVICE] Task deleted:', taskId);
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception deleting task:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Complete a task with optional notes
   */
  async completeTask(userId: string, taskId: string, notes?: string, actualDuration?: number): Promise<any> {
    try {
      console.log('✅ [SUPABASE SERVICE] Completing task:', taskId);
      const userSchema = this.getUserSchema(userId);

      const updateData: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (notes) updateData.completion_notes = notes;
      if (actualDuration !== undefined) updateData.actual_duration = actualDuration;

      const { data, error } = await this.client
        .schema(userSchema)
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error completing task:', error);
        throw error;
      }

      console.log('✅ [SUPABASE SERVICE] Task completed:', taskId);
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception completing task:', error);
      throw error;
    }
  }

  // ============================================================================
  // GOAL MANAGEMENT METHODS
  // ============================================================================

  /**
   * Create a new goal in the user's schema
   */
  async createGoal(userId: string, goalData: {
    title: string;
    description?: string;
    category?: string;
    targetDate?: string;
    status?: 'active' | 'completed' | 'paused' | 'abandoned';
    progress?: number;
    milestones?: any[];
    goalType?: 'SMART' | 'OKR' | 'milestone' | 'habit' | 'project';
    parentGoalId?: string;
    keyResults?: any[];
    blockers?: any[];
    resourcesNeeded?: any[];
    reflectionPrompts?: Record<string, any>;
    priorityScore?: number;
    energyRequirement?: 'low' | 'medium' | 'high';
    reviewFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  }): Promise<any> {
    try {
      console.log('🎯 [SUPABASE SERVICE] Creating goal for user:', userId);
      const userSchema = this.getUserSchema(userId);

      const { data, error } = await this.client
        .schema(userSchema)
        .from('goals')
        .insert({
          user_id: userId,
          title: goalData.title,
          description: goalData.description,
          category: goalData.category || 'personal',
          target_date: goalData.targetDate,
          status: goalData.status || 'active',
          progress: goalData.progress || 0,
          milestones: goalData.milestones,
          goal_type: goalData.goalType || 'SMART',
          parent_goal_id: goalData.parentGoalId,
          key_results: goalData.keyResults || [],
          blockers: goalData.blockers || [],
          resources_needed: goalData.resourcesNeeded || [],
          reflection_prompts: goalData.reflectionPrompts || {},
          priority_score: goalData.priorityScore || 5,
          energy_requirement: goalData.energyRequirement,
          review_frequency: goalData.reviewFrequency || 'weekly'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error creating goal:', error);
        throw error;
      }

      console.log('✅ [SUPABASE SERVICE] Goal created:', data.id);
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception creating goal:', error);
      throw error;
    }
  }

  /**
   * Get goals for a user with optional filters
   */
  async getGoals(userId: string, filters?: {
    status?: string;
    category?: string;
    goalType?: string;
    parentGoalId?: string;
    targetBefore?: string;
    targetAfter?: string;
  }): Promise<any[]> {
    try {
      console.log('🔍 [SUPABASE SERVICE] Getting goals for user:', userId);
      const userSchema = this.getUserSchema(userId);

      let query = this.client
        .schema(userSchema)
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('priority_score', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.goalType) {
        query = query.eq('goal_type', filters.goalType);
      }
      if (filters?.parentGoalId) {
        query = query.eq('parent_goal_id', filters.parentGoalId);
      }
      if (filters?.targetBefore) {
        query = query.lte('target_date', filters.targetBefore);
      }
      if (filters?.targetAfter) {
        query = query.gte('target_date', filters.targetAfter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error getting goals:', error);
        return [];
      }

      console.log(`✅ [SUPABASE SERVICE] Found ${data?.length || 0} goals`);
      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception getting goals:', error);
      return [];
    }
  }

  /**
   * Update a goal
   */
  async updateGoal(userId: string, goalId: string, updates: {
    title?: string;
    description?: string;
    category?: string;
    targetDate?: string;
    status?: 'active' | 'completed' | 'paused' | 'abandoned';
    progress?: number;
    milestones?: any[];
    goalType?: 'SMART' | 'OKR' | 'milestone' | 'habit' | 'project';
    parentGoalId?: string;
    keyResults?: any[];
    blockers?: any[];
    resourcesNeeded?: any[];
    reflectionPrompts?: Record<string, any>;
    priorityScore?: number;
    energyRequirement?: 'low' | 'medium' | 'high';
    reviewFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  }): Promise<any> {
    try {
      console.log('🔄 [SUPABASE SERVICE] Updating goal:', goalId);
      const userSchema = this.getUserSchema(userId);

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.progress !== undefined) updateData.progress = updates.progress;
      if (updates.milestones !== undefined) updateData.milestones = updates.milestones;
      if (updates.goalType !== undefined) updateData.goal_type = updates.goalType;
      if (updates.parentGoalId !== undefined) updateData.parent_goal_id = updates.parentGoalId;
      if (updates.keyResults !== undefined) updateData.key_results = updates.keyResults;
      if (updates.blockers !== undefined) updateData.blockers = updates.blockers;
      if (updates.resourcesNeeded !== undefined) updateData.resources_needed = updates.resourcesNeeded;
      if (updates.reflectionPrompts !== undefined) updateData.reflection_prompts = updates.reflectionPrompts;
      if (updates.priorityScore !== undefined) updateData.priority_score = updates.priorityScore;
      if (updates.energyRequirement !== undefined) updateData.energy_requirement = updates.energyRequirement;
      if (updates.reviewFrequency !== undefined) updateData.review_frequency = updates.reviewFrequency;

      const { data, error } = await this.client
        .schema(userSchema)
        .from('goals')
        .update(updateData)
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error updating goal:', error);
        throw error;
      }

      console.log('✅ [SUPABASE SERVICE] Goal updated:', goalId);
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception updating goal:', error);
      throw error;
    }
  }

  /**
   * Delete a goal
   */
  async deleteGoal(userId: string, goalId: string): Promise<{ success: boolean, error: string | null }> {
    try {
      console.log('🗑️ [SUPABASE SERVICE] Deleting goal:', goalId);
      const userSchema = this.getUserSchema(userId);

      const { error } = await this.client
        .schema(userSchema)
        .from('goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error deleting goal:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [SUPABASE SERVICE] Goal deleted:', goalId);
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception deleting goal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Add a check-in for a goal
   */
  async addGoalCheckIn(userId: string, goalId: string, checkInData: {
    progressUpdate?: string;
    moodRating?: number;
    confidenceLevel?: number;
    obstaclesEncountered?: any[];
    winsAndProgress?: any[];
    nextSteps?: any[];
    reflectionNotes?: string;
    agentInsights?: Record<string, any>;
  }): Promise<any> {
    try {
      console.log('📝 [SUPABASE SERVICE] Adding goal check-in for goal:', goalId);
      const userSchema = this.getUserSchema(userId);

      const { data, error } = await this.client
        .schema(userSchema)
        .from('goal_check_ins')
        .insert({
          goal_id: goalId,
          user_id: userId,
          check_in_date: new Date().toISOString().split('T')[0],
          progress_update: checkInData.progressUpdate,
          mood_rating: checkInData.moodRating,
          confidence_level: checkInData.confidenceLevel,
          obstacles_encountered: checkInData.obstaclesEncountered || [],
          wins_and_progress: checkInData.winsAndProgress || [],
          next_steps: checkInData.nextSteps || [],
          reflection_notes: checkInData.reflectionNotes,
          agent_insights: checkInData.agentInsights || {}
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error adding goal check-in:', error);
        throw error;
      }

      console.log('✅ [SUPABASE SERVICE] Goal check-in added:', data.id);
      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception adding goal check-in:', error);
      throw error;
    }
  }

  /**
   * Get check-ins for a goal
   */
  async getGoalCheckIns(userId: string, goalId: string, limit?: number): Promise<any[]> {
    try {
      console.log('🔍 [SUPABASE SERVICE] Getting check-ins for goal:', goalId);
      const userSchema = this.getUserSchema(userId);

      let query = this.client
        .schema(userSchema)
        .from('goal_check_ins')
        .select('*')
        .eq('goal_id', goalId)
        .eq('user_id', userId)
        .order('check_in_date', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error getting goal check-ins:', error);
        return [];
      }

      console.log(`✅ [SUPABASE SERVICE] Found ${data?.length || 0} check-ins`);
      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception getting goal check-ins:', error);
      return [];
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

// Export singleton instance
const supabaseServiceInstance = new SupabaseService();
export function getSupabaseService(): SupabaseService {
  return supabaseServiceInstance;
}

// Export function to get raw client
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}