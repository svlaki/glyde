import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseEvent, DatabaseChatMessage, DatabaseProfile, VectorSearchResult } from '../types/database.js';
import { AgentType } from '../types/agents.js';

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
    // DEPRECATED: Now using public schema with RLS
    // All tables are in public schema, filtered by user_id via RLS policies
    return 'public';
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
  // DEPRECATED: Use getEvents() instead. This method is no longer needed.
  // Timezone conversion should happen in the Agent layer, not the Service layer.
  async getEventsForAgent(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    console.warn('⚠️ getEventsForAgent is deprecated. Use getEvents() instead.');
    return this.getEvents(userId, startDate, endDate);
  }

  // Method for frontend - no timezone conversion (frontend handles it)
  // Returns all events as UTC timestamps from database
  // NO timezone conversion - caller (Agent or Frontend) handles display timezone
  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    try {
      // Use the new function that joins category data
      const { data, error } = await this.client
        .rpc('get_events_with_categories', {
          p_user_id: userId,
          p_start_date: startDate || null,
          p_end_date: endDate || null
        });

      if (error) {
        console.error('Error fetching events:', error);
        return [];
      }

      console.log('✅ [SUPABASE SERVICE] Retrieved', data?.length || 0, 'events (UTC) with categories for user');

      // Transform to match DatabaseEvent interface - convert timestamps to ISO 8601
      const transformedEvents: DatabaseEvent[] = (data || []).map((event: any) => ({
        id: event.id,
        user_id: event.user_id,
        title: event.title,
        // Ensure dates are in ISO 8601 format for JavaScript Date parsing
        start_time: new Date(event.start_time).toISOString(),
        end_time: new Date(event.end_time).toISOString(),
        location: event.location,
        description: event.description,
        created_at: event.created_at,
        updated_at: event.updated_at,
        category: event.category_name || 'Personal', // For backward compatibility
        category_id: event.category_id,
        category_name: event.category_name,
        category_color: event.category_color,
        category_icon: event.category_icon
      }));

      return transformedEvents;
    } catch (error) {
      console.error('Exception fetching events:', error);
      return [];
    }
  }

  // Accepts UTC timestamps for start_time and end_time
  // NO timezone conversion - caller must provide UTC times
  async createEvent(userId: string, event: Partial<DatabaseEvent> & {category?: string; category_id?: string}): Promise<DatabaseEvent | null> {
    try {
      console.log('🔧 [SUPABASE SERVICE] Creating event for user:', userId);

      // Extract event data - times should already be in UTC
      const title = event.title || 'Untitled Event';
      const description = event.description || null;
      const location = event.location || null;
      const startTime = event.start_time || new Date().toISOString();
      const endTime = event.end_time || new Date().toISOString();

      // Handle category - prefer category_id, fallback to category name lookup
      let categoryId = event.category_id || null;
      
      if (!categoryId && event.category) {
        // Look up category by name
        const { data: categoryData } = await this.client
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', event.category)
          .single();
        
        categoryId = categoryData?.id || null;
      }

      // Insert into public schema (RLS handles user filtering)
      const { data, error } = await this.client
        .from('events')
        .insert({
          user_id: userId,
          title: title,
          start_time: startTime, // Must be UTC
          end_time: endTime,     // Must be UTC
          location: location,
          description: description,
          category: event.category || 'Personal', // Keep for backward compatibility
          category_id: categoryId
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating event:', error);
        return null;
      }

      console.log('✅ [SUPABASE SERVICE] Event created:', data.id);

      // Fetch with category data
      const eventsWithCategories = await this.getEvents(userId, startTime, endTime);
      const createdEvent = eventsWithCategories.find(e => e.id === data.id);
      
      return createdEvent || null;
    } catch (error) {
      console.error('Exception creating event:', error);
      return null;
    }
  }

  // Accepts UTC timestamps for start_time and end_time
  // NO timezone conversion - caller must provide UTC times
  async updateEvent(userId: string, eventId: string, updates: Partial<DatabaseEvent> & {category?: string; category_id?: string}): Promise<DatabaseEvent | null> {
    try {
      console.log('🔧 [SUPABASE SERVICE] Updating event for user:', userId);
      console.log('🔍 [SUPABASE SERVICE] Event ID:', eventId);
      console.log('🔍 [SUPABASE SERVICE] Updates (must be UTC):', JSON.stringify(updates, null, 2));

      // Build update object with only provided fields
      // Note: start_time and end_time must already be in UTC format from caller
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.start_time !== undefined) {
        updateData.start_time = updates.start_time; // Must be UTC from caller
      }
      if (updates.end_time !== undefined) {
        updateData.end_time = updates.end_time; // Must be UTC from caller
      }
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.description !== undefined) updateData.description = updates.description;
      
      // Handle category - prefer category_id, fallback to category name lookup
      if (updates.category_id !== undefined) {
        updateData.category_id = updates.category_id;
      } else if (updates.category !== undefined) {
        updateData.category = updates.category; // Keep for backward compatibility
        
        // Look up category by name to set category_id
        const { data: categoryData } = await this.client
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', updates.category)
          .single();
        
        if (categoryData?.id) {
          updateData.category_id = categoryData.id;
        }
      }

      // Update in public schema (RLS handles user filtering)
      const { data, error } = await this.client
        .from('events')
        .update(updateData)
        .eq('id', eventId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating event:', error);
        return null;
      }

      console.log('✅ [SUPABASE SERVICE] Event updated successfully');

      // Fetch with category data
      const eventsWithCategories = await this.getEvents(userId);
      const updatedEvent = eventsWithCategories.find(e => e.id === eventId);
      
      return updatedEvent || null;
    } catch (error) {
      console.error('Exception updating event:', error);
      return null;
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<{ success: boolean, error: string | null }> {
    try {
      console.log('🗑️ [SUPABASE SERVICE] Deleting event for user:', userId);
      console.log('🔍 [SUPABASE SERVICE] Event ID:', eventId);

      // Delete from public schema (RLS handles user filtering)
      const { error } = await this.client
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting event:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [SUPABASE SERVICE] Event deleted successfully');
      return { success: true, error: null };
    } catch (error) {
      console.error('Exception deleting event:', error);
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
    category_id?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    parentGoalId?: string;
    color?: string;
    energyRequired?: 'low' | 'medium' | 'high';
    estimatedDuration?: number;
    contextRequired?: Record<string, any>;
    recurringPattern?: Record<string, any>;
  }): Promise<any> {
    try {
      console.log('📝 [SUPABASE SERVICE] Creating task for user:', userId);

      // Handle category - prefer category_id, fallback to category name lookup
      let categoryId = taskData.category_id || null;
      
      if (!categoryId && taskData.category) {
        // Look up category by name
        const { data: categoryData } = await this.client
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', taskData.category)
          .single();
        
        categoryId = categoryData?.id || null;
      }

      const { data, error } = await this.client
        .from('tasks')
        .insert({
          user_id: userId,
          title: taskData.title,
          description: taskData.description,
          category: taskData.category || 'Personal', // Keep for backward compatibility
          category_id: categoryId,
          due_date: taskData.dueDate,
          priority: taskData.priority || 'medium',
          status: taskData.status || 'pending',
          parent_goal_id: taskData.parentGoalId,
          color: taskData.color,
          energy_required: taskData.energyRequired,
          estimated_duration: taskData.estimatedDuration,
          context_required: taskData.contextRequired || {},
          recurring_pattern: taskData.recurringPattern || {}
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

      // Use the new function that joins category data
      const { data, error } = await this.client
        .rpc('get_tasks_with_categories', {
          p_user_id: userId
        });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error getting tasks:', error);
        return [];
      }

      let filteredTasks = data || [];

      // Apply filters client-side since RPC function doesn't support them yet
      if (filters?.status) {
        filteredTasks = filteredTasks.filter((t: any) => t.status === filters.status);
      }
      if (filters?.category) {
        // Support both old category name and new category_name
        filteredTasks = filteredTasks.filter((t: any) => 
          t.category_name === filters.category || t.category === filters.category
        );
      }
      if (filters?.priority) {
        filteredTasks = filteredTasks.filter((t: any) => t.priority === filters.priority);
      }
      if (filters?.parentGoalId) {
        filteredTasks = filteredTasks.filter((t: any) => t.parent_goal_id === filters.parentGoalId);
      }
      if (filters?.dueBefore) {
        filteredTasks = filteredTasks.filter((t: any) => t.due_date && t.due_date <= filters.dueBefore!);
      }
      if (filters?.dueAfter) {
        filteredTasks = filteredTasks.filter((t: any) => t.due_date && t.due_date >= filters.dueAfter!);
      }

      console.log(`✅ [SUPABASE SERVICE] Found ${filteredTasks.length} tasks with categories`);
      return filteredTasks;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception getting tasks:', error);
      return [];
    }
  }

  /**
   * Create an interaction card for the user that agents can respond to
   */
  async createUserInteraction(
    userId: string,
    interaction: {
      agentId: AgentType | string;
      question: string;
      interactionType: 'yes_no' | 'multiple_choice' | 'confirmation';
      options?: string[] | null;
      priority?: number;
      categoryId?: string | null;
      entityId?: string | null;
      metadata?: Record<string, any> | null;
      expiresAt?: string | null;
    }
  ): Promise<any | null> {
    try {
      const insertPayload = {
        user_id: userId,
        agent_id: interaction.agentId,
        question: interaction.question,
        interaction_type: interaction.interactionType,
        options: interaction.options ?? null,
        priority: interaction.priority ?? 5,
        category_id: interaction.categoryId ?? null,
        entity_id: interaction.entityId ?? null,
        metadata: interaction.metadata ?? null,
        expires_at: interaction.expiresAt ?? null,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await this.client
        .from('user_interactions')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          console.warn('⚠️ [SUPABASE SERVICE] Duplicate interaction ignored:', interaction.question);
          return null;
        }

        if (error.code === '23514') {
          // Constraint violation (likely status enum). Try with legacy value "active"
          const fallbackPayload = { ...insertPayload, status: 'active' };
          const { data: fallbackData, error: fallbackError } = await this.client
            .from('user_interactions')
            .insert(fallbackPayload)
            .select('*')
            .single();

          if (fallbackError) {
            console.error('❌ [SUPABASE SERVICE] Error creating interaction with fallback status:', fallbackError);
            throw fallbackError;
          }

          return fallbackData;
        }

        console.error('❌ [SUPABASE SERVICE] Error creating interaction:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception creating interaction:', error);
      throw error;
    }
  }

  /**
   * Get all pending interactions for a user (optionally filtered by agent)
   */
  async getPendingUserInteractions(userId: string, agentId?: string): Promise<any[]> {
    try {
      const nowIso = new Date().toISOString();

      let query = this.client
        .from('user_interactions')
        .select(`
          *,
          category:categories(id, name, color)
        `)
        .eq('user_id', userId)
        .in('status', ['pending', 'active'])
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error fetching pending interactions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception fetching pending interactions:', error);
      return [];
    }
  }

  /**
   * Get a single interaction by ID
   */
  async getUserInteractionById(interactionId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('user_interactions')
        .select('*')
        .eq('id', interactionId)
        .single();

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error fetching interaction:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception fetching interaction:', error);
      return null;
    }
  }

  /**
   * Record a user's response to an interaction and mark it as responded
   */
  async saveInteractionResponse(
    userId: string,
    interactionId: string,
    response: string
  ): Promise<{ interaction: any; response: any } | null> {
    const respondedAt = new Date().toISOString();

    try {
      const { data: interaction, error: interactionError } = await this.client
        .from('user_interactions')
        .select('*')
        .eq('id', interactionId)
        .single();

      if (interactionError || !interaction) {
        console.error('❌ [SUPABASE SERVICE] Interaction not found when saving response:', interactionError);
        return null;
      }

      const { data: responseRow, error: responseError } = await this.client
        .from('interaction_responses')
        .insert({
          interaction_id: interactionId,
          user_id: userId,
          response,
          responded_at: respondedAt,
        })
        .select('*')
        .single();

      if (responseError) {
        console.error('❌ [SUPABASE SERVICE] Error saving interaction response:', responseError);
        throw responseError;
      }

      const updateData: Record<string, any> = {
        status: 'responded'
      };

      if (interaction && 'responded_at' in interaction) {
        updateData.responded_at = respondedAt;
      }

      if (interaction && 'updated_at' in interaction) {
        updateData.updated_at = respondedAt;
      }

      const { data: updatedInteraction, error: updateError } = await this.client
        .from('user_interactions')
        .update(updateData)
        .eq('id', interactionId)
        .select('*')
        .single();

      if (updateError) {
        console.error('❌ [SUPABASE SERVICE] Error updating interaction status:', updateError);
        throw updateError;
      }

      return { interaction: updatedInteraction, response: responseRow };
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception saving interaction response:', error);
      throw error;
    }
  }

  /**
   * Cancel all pending interactions for a user (primarily for development utilities)
   */
  async cancelPendingInteractions(userId: string): Promise<number> {
    try {
      const updateData: Record<string, any> = {
        status: 'cancelled'
      };

      const sample = await this.client
        .from('user_interactions')
        .select('id, updated_at, status')
        .eq('user_id', userId)
        .limit(1);

      if (!sample.error && sample.data && sample.data.length > 0) {
        if ('updated_at' in sample.data[0]) {
          updateData.updated_at = new Date().toISOString();
        }
      }

      const { data, error } = await this.client
        .from('user_interactions')
        .update(updateData)
        .eq('user_id', userId)
        .in('status', ['pending', 'active'])
        .select('id');

      if (error) {
        if (error.code === '23514') {
          const fallbackUpdate = { ...updateData, status: 'dismissed' };
          const { data: fallbackData, error: fallbackError } = await this.client
            .from('user_interactions')
            .update(fallbackUpdate)
            .eq('user_id', userId)
            .eq('status', 'active')
            .select('id');

          if (fallbackError) {
            console.error('❌ [SUPABASE SERVICE] Error cancelling interactions with fallback:', fallbackError);
            return 0;
          }

          return fallbackData?.length || 0;
        }

        console.error('❌ [SUPABASE SERVICE] Error cancelling interactions:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception cancelling interactions:', error);
      return 0;
    }
  }

  /**
   * Update a task
   */
  async updateTask(userId: string, taskId: string, updates: {
    title?: string;
    description?: string;
    category?: string;
    category_id?: string;
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
  }): Promise<any> {
    try {
      console.log('🔄 [SUPABASE SERVICE] Updating task:', taskId);

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
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

      // Handle category - prefer category_id, fallback to category name lookup
      if (updates.category_id !== undefined) {
        updateData.category_id = updates.category_id;
      } else if (updates.category !== undefined) {
        updateData.category = updates.category; // Keep for backward compatibility
        
        // Look up category by name to set category_id
        const { data: categoryData } = await this.client
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', updates.category)
          .single();
        
        if (categoryData?.id) {
          updateData.category_id = categoryData.id;
        }
      }

      const { data, error } = await this.client
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

      const { error } = await this.client
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

      const updateData: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (notes) updateData.completion_notes = notes;
      if (actualDuration !== undefined) updateData.actual_duration = actualDuration;

      const { data, error } = await this.client
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
    category_id?: string;
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

      // Handle category - prefer category_id, fallback to category name lookup
      let categoryId = goalData.category_id || null;
      
      if (!categoryId && goalData.category) {
        // Look up category by name
        const { data: categoryData } = await this.client
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', goalData.category)
          .single();
        
        categoryId = categoryData?.id || null;
      }

      const { data, error } = await this.client
        .from('goals')
        .insert({
          user_id: userId,
          title: goalData.title,
          description: goalData.description,
          category: goalData.category || 'Personal', // Keep for backward compatibility
          category_id: categoryId,
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

      // Use the new function that joins category data
      const { data, error } = await this.client
        .rpc('get_goals_with_categories', {
          p_user_id: userId
        });

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error getting goals:', error);
        return [];
      }

      let filteredGoals = data || [];

      // Apply filters client-side since RPC function doesn't support them yet
      if (filters?.status) {
        filteredGoals = filteredGoals.filter((g: any) => g.status === filters.status);
      }
      if (filters?.category) {
        // Support both old category name and new category_name
        filteredGoals = filteredGoals.filter((g: any) => 
          g.category_name === filters.category || g.category === filters.category
        );
      }
      if (filters?.goalType) {
        filteredGoals = filteredGoals.filter((g: any) => g.goal_type === filters.goalType);
      }
      if (filters?.parentGoalId) {
        filteredGoals = filteredGoals.filter((g: any) => g.parent_goal_id === filters.parentGoalId);
      }
      if (filters?.targetBefore) {
        filteredGoals = filteredGoals.filter((g: any) => g.target_date && g.target_date <= filters.targetBefore!);
      }
      if (filters?.targetAfter) {
        filteredGoals = filteredGoals.filter((g: any) => g.target_date && g.target_date >= filters.targetAfter!);
      }

      console.log(`✅ [SUPABASE SERVICE] Found ${filteredGoals.length} goals with categories`);
      return filteredGoals;
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
    category_id?: string;
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

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
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

      // Handle category - prefer category_id, fallback to category name lookup
      if (updates.category_id !== undefined) {
        updateData.category_id = updates.category_id;
      } else if (updates.category !== undefined) {
        updateData.category = updates.category; // Keep for backward compatibility
        
        // Look up category by name to set category_id
        const { data: categoryData } = await this.client
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', updates.category)
          .single();
        
        if (categoryData?.id) {
          updateData.category_id = categoryData.id;
        }
      }

      const { data, error } = await this.client
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

      const { error } = await this.client
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

      const { data, error } = await this.client
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

      let query = this.client
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
    console.log('🔍 DEBUG: Calling match_events with:', {
      user_id: userId,
      embedding_length: queryEmbedding.length,
      match_count: limit
    });

    const { data, error } = await this.client
      .rpc('match_events', {
        query_embedding: queryEmbedding,
        match_count: limit,
        filter: { user_id: userId }
      });

    if (error) {
      console.error('Error searching similar events:', error);
      return [];
    }

    return data || [];
  }

  async searchSimilarChats(userId: string, queryEmbedding: number[], limit: number = 10): Promise<VectorSearchResult<DatabaseChatMessage>[]> {
    const { data, error } = await this.client
      .rpc('match_chat_messages', {
        query_embedding: queryEmbedding,
        match_count: limit,
        filter: { user_id: userId }
      });

    if (error) {
      console.error('Error searching similar chats:', error);
      return [];
    }

    return data || [];
  }

  async getUserSettings(userId: string): Promise<Record<string, any>> {
    try {
      if (!userId) {
        throw new Error('User ID is required to fetch settings');
      }

      const { data, error } = await this.client
        .from('settings')
        .select('key, value')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching settings:', error);
        return {};
      }

      if (!data) {
        return {};
      }

      return data.reduce<Record<string, any>>((settings, setting: any) => {
        if (setting?.key !== undefined) {
          settings[setting.key] = setting.value;
        }
        return settings;
      }, {});
    } catch (error) {
      console.error('Exception fetching settings:', error);
      return {};
    }
  }

  async updateUserSetting(userId: string, key: string, value: any): Promise<boolean> {
    try {
      if (!userId) {
        throw new Error('User ID is required to update settings');
      }

      if (!key || typeof key !== 'string') {
        throw new Error('Setting key must be a non-empty string');
      }

      const { error } = await this.client
        .from('settings')
        .upsert([{
          user_id: userId,
          key,
          value,
          updated_at: new Date().toISOString(),
        }], {
          onConflict: 'user_id,key',
        });

      if (error) {
        console.error('Error updating setting:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception updating setting:', error);
      return false;
    }
  }

  async subscribeToUserChanges(userId: string, callback: (payload: any) => void) {
    return this.client
      .channel(`user_changes_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events',
        filter: `user_id=eq.${userId}`
      }, callback)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `user_id=eq.${userId}`
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
