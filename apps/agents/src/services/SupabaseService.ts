import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseEvent, DatabaseChatMessage, DatabaseProfile, VectorSearchResult } from '../types/database.js';
import { AgentType } from '../types/agents.js';

// Activity log types
export type ActivityEntityType = 'event' | 'task' | 'goal' | 'category' | 'profile' | 'rule';
export type ActivityOperation = 'create' | 'update' | 'delete' | 'complete' | 'uncomplete' | 'archive';
export type ActivitySource = 'user' | 'agent';

export interface ActivityChange {
  old: any;
  new: any;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  entity_title: string | null;
  operation: ActivityOperation;
  changes: Record<string, ActivityChange> | null;
  source: ActivitySource;
  agent_type: string | null;
  created_at: string;
}

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

  /**
   * Helper: Resolve category_id from either category_id or category name
   * Eliminates 60+ lines of duplicate code across 6 methods
   */
  private async resolveCategoryId(userId: string, category?: string, category_id?: string): Promise<string | null> {
    if (category_id) return category_id;
    if (!category) return null;

    const { data } = await this.client
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', category)
      .single();

    return data?.id || null;
  }

  /**
   * Helper: Validate UUID format to prevent database errors
   * Returns true if the ID is a valid UUID, false otherwise
   */
  private isValidUUID(id: any): boolean {
    if (typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Helper: Generic delete operation with consistent error handling
   */
  private async deleteRecord(table: string, userId: string, recordId: string, entityName: string): Promise<{ success: boolean, error: string | null }> {
    try {
      // Validate recordId format
      if (!this.isValidUUID(recordId)) {
        const errorMsg = `Invalid ${entityName} ID format: "${recordId}" is not a valid UUID`;
        console.error(`❌ Invalid UUID for ${entityName}:`, recordId);
        return { success: false, error: errorMsg };
      }

      const { error } = await this.client
        .from(table)
        .delete()
        .eq('id', recordId)
        .eq('user_id', userId);

      if (error) {
        console.error(`Error deleting ${entityName}:`, error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error(`Exception deleting ${entityName}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ============================================================================
  // ACTIVITY LOGGING METHODS
  // ============================================================================

  /**
   * Log an activity to the activity log
   * @param userId User ID
   * @param entityType Type of entity (event, task, goal, etc.)
   * @param entityId ID of the entity
   * @param entityTitle Title of the entity for display
   * @param operation Operation performed (create, update, delete, etc.)
   * @param changes Field changes { field: { old: value, new: value } }
   * @param source Who made the change (user or agent)
   * @param agentType Which agent made the change (only when source=agent)
   */
  async logActivity(
    userId: string,
    entityType: ActivityEntityType,
    entityId: string,
    entityTitle: string | null,
    operation: ActivityOperation,
    changes: Record<string, ActivityChange> | null = null,
    source: ActivitySource = 'user',
    agentType: string | null = null
  ): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('user_activity_log')
        .insert({
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          entity_title: entityTitle,
          operation: operation,
          changes: changes,
          source: source,
          agent_type: agentType
        })
        .select('id')
        .single();

      if (error) {
        console.warn('[ACTIVITY LOG] Error logging activity:', error.message);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.warn('[ACTIVITY LOG] Exception logging activity:', error);
      return null;
    }
  }

  /**
   * Get recent activity for a user
   * @param userId User ID
   * @param source Filter by source ('user', 'agent', or null for all)
   * @param minutes How far back to look (default 30)
   * @param limit Maximum number of entries (default 20)
   */
  async getRecentActivity(
    userId: string,
    source: ActivitySource | null = null,
    minutes: number = 30,
    limit: number = 20
  ): Promise<ActivityLogEntry[]> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

      let query = this.client
        .from('user_activity_log')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (source) {
        query = query.eq('source', source);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[ACTIVITY LOG] Error fetching activity:', error.message);
        return [];
      }

      return (data || []) as ActivityLogEntry[];
    } catch (error) {
      console.warn('[ACTIVITY LOG] Exception fetching activity:', error);
      return [];
    }
  }

  /**
   * Helper to compute changes between old and new objects
   * Only includes fields that actually changed
   */
  private computeChanges(
    oldObj: Record<string, any> | null,
    newObj: Record<string, any>,
    fieldsToTrack: string[]
  ): Record<string, ActivityChange> | null {
    if (!oldObj) return null;

    const changes: Record<string, ActivityChange> = {};

    for (const field of fieldsToTrack) {
      const oldVal = oldObj[field];
      const newVal = newObj[field];

      // Only track if the field is being updated and value changed
      if (newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[field] = { old: oldVal, new: newVal };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
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

  /**
   * Get categories for a user
   */
  async getCategories(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching categories:', error);
      return [];
    }
  }

  // Method for agents - includes timezone conversion for proper local time display
  // DEPRECATED: Use getEvents() instead. This method is no longer needed.
  // Timezone conversion should happen in the Agent layer, not the Service layer.
  async getEventsForAgent(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    console.warn('getEventsForAgent is deprecated. Use getEvents() instead.');
    return this.getEvents(userId, startDate, endDate);
  }

  // Internal method to fetch raw events from database (no expansion)
  private async getRawEvents(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
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
        category_icon: event.category_icon,
        // Recurrence fields
        recurrence_rule: event.recurrence_rule,
        recurrence_end: event.recurrence_end,
        parent_event_id: event.parent_event_id,
        is_recurring: event.is_recurring || false
      }));

      return transformedEvents;
    } catch (error) {
      console.error('Exception fetching events:', error);
      return [];
    }
  }

  // Method for frontend and agents - returns all events with recurring events expanded
  // NO timezone conversion - caller (Agent or Frontend) handles display timezone
  async getEvents(userId: string, startDate?: string, endDate?: string): Promise<DatabaseEvent[]> {
    try {
      // Import rrule utilities
      const {
        expandRecurrenceWithEndTime,
        validateRRule
      } = await import('../utils/rrule.js');

      // Get raw events from database
      const rawEvents = await this.getRawEvents(userId, startDate, endDate);

      if (!rawEvents || rawEvents.length === 0) {
        return [];
      }

      // Fetch all exceptions for this user's recurring events
      const { data: exceptions } = await this.client
        .from('recurring_event_exceptions')
        .select('parent_event_id, exception_date, exception_type')
        .eq('user_id', userId);

      // Build a map of exceptions by parent_event_id -> Set of exception dates
      const exceptionMap = new Map<string, Set<string>>();
      if (exceptions) {
        for (const exc of exceptions) {
          if (!exceptionMap.has(exc.parent_event_id)) {
            exceptionMap.set(exc.parent_event_id, new Set());
          }
          // Only track deleted exceptions (modified ones have separate override events)
          if (exc.exception_type === 'deleted') {
            exceptionMap.get(exc.parent_event_id)!.add(exc.exception_date);
          }
        }
      }

      const expandedEvents: DatabaseEvent[] = [];
      // For date filtering: only apply if explicitly provided
      const hasStartFilter = !!startDate;
      const hasEndFilter = !!endDate;
      const startD = startDate ? new Date(startDate) : null;
      // Default end date: 1 year from now if not specified
      const now = new Date();
      const endD = endDate ? new Date(endDate) : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      for (const event of rawEvents) {
        if (event.is_recurring && event.recurrence_rule) {
          // Validate and expand recurring event
          if (!validateRRule(event.recurrence_rule)) {
            console.warn('⚠️  [SupabaseService] Invalid RRULE for event:', event.id, event.recurrence_rule);
            expandedEvents.push(event); // Add parent anyway
            continue;
          }

          // Get deleted dates for this event
          const deletedDates = exceptionMap.get(event.id) || new Set();

          // Expand instances from the event's original start date
          const startT = new Date(event.start_time);
          const endT = new Date(event.end_time);
          const instances = expandRecurrenceWithEndTime(
            event.recurrence_rule,
            startT,
            endT,
            event.recurrence_end ? new Date(event.recurrence_end) : endD
          );

          // Add all instances (filter by date range only if explicitly requested)
          for (const instance of instances) {
            const instanceDate = instance.start.toISOString().split('T')[0];

            // Skip deleted instances
            if (deletedDates.has(instanceDate)) {
              continue;
            }

            // Apply date filters only if explicitly provided
            if (hasStartFilter && startD && instance.start < startD) {
              continue;
            }
            if (hasEndFilter && instance.start > endD) {
              continue;
            }
            // If no end filter, still limit to 1 year from now to prevent infinite expansion
            if (!hasEndFilter && instance.start > endD) {
              continue;
            }

            expandedEvents.push({
              ...event,
              start_time: instance.start.toISOString(),
              end_time: instance.end.toISOString(),
              parent_event_id: event.id, // Reference to parent for updates/deletes
              is_recurring: true,
              is_instance: true, // Flag to indicate this is an expanded instance, not a DB record
              instance_date: instanceDate // YYYY-MM-DD for identifying this instance
            });
          }
        } else {
          // Regular non-recurring event
          expandedEvents.push(event);
        }
      }

      // Sort by start time
      expandedEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      console.log('✅ [SUPABASE SERVICE] Retrieved', rawEvents.length, 'raw events, expanded to', expandedEvents.length, 'events for user');

      return expandedEvents;
    } catch (error) {
      console.error('Exception fetching/expanding events:', error);
      // Fallback to raw events if expansion fails
      return this.getRawEvents(userId, startDate, endDate);
    }
  }

  // Accepts UTC timestamps for start_time and end_time
  // NO timezone conversion - caller must provide UTC times
  async createEvent(
    userId: string,
    event: Partial<DatabaseEvent> & {category?: string; category_id?: string},
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<DatabaseEvent | null> {
    try {
      // Extract event data - times should already be in UTC
      const title = event.title || 'Untitled Event';
      const description = event.description || null;
      const location = event.location || null;
      const startTime = event.start_time || new Date().toISOString();
      const endTime = event.end_time || new Date().toISOString();

      // Handle category using helper method
      const categoryId = await this.resolveCategoryId(userId, event.category, event.category_id);

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

      // Log activity
      await this.logActivity(
        userId,
        'event',
        data.id,
        title,
        'create',
        null,
        options?.source || 'user',
        options?.agentType || null
      );

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
  async updateEvent(
    userId: string,
    eventId: string,
    updates: Partial<DatabaseEvent> & {category?: string; category_id?: string},
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<DatabaseEvent | null> {
    try {
      // Validate eventId format
      if (!this.isValidUUID(eventId)) {
        console.error('❌ [SUPABASE SERVICE] Invalid UUID:', eventId);
        return null;
      }

      // Fetch old event for change tracking
      const { data: oldEvent } = await this.client
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

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

      // Handle category using helper method
      if (updates.category_id !== undefined || updates.category !== undefined) {
        updateData.category_id = await this.resolveCategoryId(userId, updates.category, updates.category_id);
        if (updates.category) updateData.category = updates.category; // Backward compatibility
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

      // Log activity with changes
      const changes = this.computeChanges(
        oldEvent,
        updateData,
        ['title', 'start_time', 'end_time', 'location', 'description', 'category', 'category_id']
      );
      await this.logActivity(
        userId,
        'event',
        eventId,
        data.title || oldEvent?.title,
        'update',
        changes,
        options?.source || 'user',
        options?.agentType || null
      );

      // Fetch with category data
      const eventsWithCategories = await this.getEvents(userId);
      const updatedEvent = eventsWithCategories.find(e => e.id === eventId);

      return updatedEvent || null;
    } catch (error) {
      console.error('Exception updating event:', error);
      return null;
    }
  }

  async deleteEvent(
    userId: string,
    eventId: string,
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<{ success: boolean, error: string | null }> {
    // Fetch event title before deletion for logging
    const { data: event } = await this.client
      .from('events')
      .select('title')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single();

    const result = await this.deleteRecord('events', userId, eventId, 'event');

    if (result.success) {
      await this.logActivity(
        userId,
        'event',
        eventId,
        event?.title || 'Unknown Event',
        'delete',
        null,
        options?.source || 'user',
        options?.agentType || null
      );
    }

    return result;
  }

  // ============================================================================
  // RECURRING EVENT METHODS
  // ============================================================================

  /**
   * Create a recurring event (parent record)
   * @param userId User ID
   * @param event Event data with recurrence rule
   * @returns Created parent event
   */
  async createRecurringEvent(
    userId: string,
    event: Partial<DatabaseEvent> & {
      category?: string;
      category_id?: string;
      recurrence_rule: string; // RFC 5545 format
      recurrence_end?: string; // Optional end date for recurrence
    }
  ): Promise<DatabaseEvent | null> {
    try {
      const title = event.title || 'Untitled Event';
      const description = event.description || null;
      const location = event.location || null;
      const startTime = event.start_time || new Date().toISOString();
      const endTime = event.end_time || new Date().toISOString();
      const rrule = event.recurrence_rule;

      if (!rrule) {
        console.error('❌ [SupabaseService] Missing recurrence_rule');
        return null;
      }

      // Handle category
      const categoryId = await this.resolveCategoryId(userId, event.category, event.category_id);

      // Insert parent recurring event
      const { data, error } = await this.client
        .from('events')
        .insert({
          user_id: userId,
          title: title,
          start_time: startTime,
          end_time: endTime,
          location: location,
          description: description,
          category: event.category || 'Personal',
          category_id: categoryId,
          recurrence_rule: rrule,
          recurrence_end: event.recurrence_end || null,
          parent_event_id: null, // This is the parent
          is_recurring: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [SupabaseService] Error creating recurring event:', error);
        return null;
      }

      console.log('✅ [SupabaseService] Created recurring event:', data.id);

      // Fetch with category data
      const eventsWithCategories = await this.getEvents(userId, startTime, endTime);
      const createdEvent = eventsWithCategories.find(e => e.id === data.id);

      return createdEvent || null;
    } catch (error) {
      console.error('❌ [SupabaseService] Exception creating recurring event:', error);
      return null;
    }
  }

  /**
   * Get events with expanded recurring instances for a date range
   * Combines regular events with expanded recurring event instances
   */
  // Deprecated: getEvents() now automatically expands recurring events
  // This method is kept for backward compatibility
  async getExpandedEvents(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<DatabaseEvent & { is_instance?: boolean; parent_event_id_ref?: string }>> {
    // Just forward to getEvents() which now handles expansion
    return this.getEvents(userId, startDate, endDate);
  }

  /**
   * Update a single instance of a recurring event
   * Creates a new event record for the modified instance
   */
  async updateRecurringEventInstance(
    userId: string,
    parentEventId: string,
    instanceDate: string, // ISO 8601 of the instance start
    updates: Partial<DatabaseEvent>
  ): Promise<DatabaseEvent | null> {
    try {
      // Get parent event
      const parentEvent = await this.getEvents(userId, undefined, undefined);
      const parent = parentEvent?.find(e => e.id === parentEventId && e.is_recurring);

      if (!parent) {
        console.error('❌ [SupabaseService] Parent recurring event not found:', parentEventId);
        return null;
      }

      // Create instance with parent reference
      const instanceStartDate = new Date(instanceDate);
      const duration = new Date(parent.end_time).getTime() - new Date(parent.start_time).getTime();
      const instanceEndDate = new Date(instanceStartDate.getTime() + duration);

      const { data, error } = await this.client
        .from('events')
        .insert({
          user_id: userId,
          title: updates.title || parent.title,
          start_time: instanceStartDate.toISOString(),
          end_time: instanceEndDate.toISOString(),
          location: updates.location !== undefined ? updates.location : parent.location,
          description: updates.description !== undefined ? updates.description : parent.description,
          category: updates.category || parent.category,
          category_id: updates.category_id || parent.category_id,
          parent_event_id: parentEventId, // Link back to parent
          is_recurring: false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [SupabaseService] Error creating instance override:', error);
        return null;
      }

      console.log('✅ [SupabaseService] Created instance override for parent:', parentEventId);

      // Fetch with category data
      const eventsWithCategories = await this.getEvents(userId, instanceStartDate.toISOString(), instanceEndDate.toISOString());
      const createdInstance = eventsWithCategories.find(e => e.id === data.id);

      return createdInstance || null;
    } catch (error) {
      console.error('❌ [SupabaseService] Exception updating recurring instance:', error);
      return null;
    }
  }

  /**
   * Delete a single instance of a recurring event
   * Creates a deletion record or marks instance as deleted
   */
  async deleteRecurringEventInstance(userId: string, parentEventId: string, instanceDate: string): Promise<boolean> {
    try {
      // Extract just the date part (YYYY-MM-DD) from the instance date
      const exceptionDate = instanceDate.split('T')[0];

      console.log('🗑️  [SupabaseService] Creating exception record to delete instance:', {
        parentEventId,
        instanceDate: exceptionDate
      });

      // Create an exception record to mark this instance as deleted
      const { error } = await this.client
        .from('recurring_event_exceptions')
        .upsert({
          user_id: userId,
          parent_event_id: parentEventId,
          exception_date: exceptionDate,
          exception_type: 'deleted'
        }, {
          onConflict: 'parent_event_id,exception_date'
        });

      if (error) {
        console.error('❌ [SupabaseService] Error creating exception record:', error);
        return false;
      }

      console.log('✅ [SupabaseService] Successfully marked instance as deleted:', exceptionDate);
      return true;
    } catch (error) {
      console.error('❌ [SupabaseService] Exception deleting recurring instance:', error);
      return false;
    }
  }

  /**
   * Update entire recurring event series (parent)
   * Modifies the parent record and RRULE
   */
  async updateRecurringEventSeries(
    userId: string,
    parentEventId: string,
    updates: Partial<DatabaseEvent> & {
      recurrence_rule?: string;
      recurrence_end?: string;
    }
  ): Promise<DatabaseEvent | null> {
    try {
      // Validate if new RRULE provided
      if (updates.recurrence_rule) {
        const { validateRRule } = await import('../utils/rrule.js');
        if (!validateRRule(updates.recurrence_rule)) {
          console.error('❌ [SupabaseService] Invalid recurrence rule');
          return null;
        }
      }

      const updateData: Record<string, any> = {};

      if (updates.title) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.start_time) updateData.start_time = updates.start_time;
      if (updates.end_time) updateData.end_time = updates.end_time;
      if (updates.recurrence_rule) updateData.recurrence_rule = updates.recurrence_rule;
      if (updates.recurrence_end !== undefined) updateData.recurrence_end = updates.recurrence_end;
      if (updates.category_id) updateData.category_id = updates.category_id;
      if (updates.category) updateData.category = updates.category;

      const { data, error } = await this.client
        .from('events')
        .update(updateData)
        .eq('id', parentEventId)
        .eq('user_id', userId)
        .eq('is_recurring', true)
        .select()
        .single();

      if (error) {
        console.error('❌ [SupabaseService] Error updating recurring series:', error);
        return null;
      }

      console.log('✅ [SupabaseService] Updated recurring series:', parentEventId);

      // Fetch with category data
      const eventsWithCategories = await this.getEvents(userId);
      const updatedEvent = eventsWithCategories.find(e => e.id === data.id);

      return updatedEvent || null;
    } catch (error) {
      console.error('❌ [SupabaseService] Exception updating recurring series:', error);
      return null;
    }
  }

  /**
   * Delete entire recurring event series
   * Cascades to delete all instances via FK constraint
   */
  async deleteRecurringEventSeries(userId: string, parentEventId: string): Promise<boolean> {
    try {
      const result = await this.deleteEvent(userId, parentEventId);
      if (result.success) {
        console.log('✅ [SupabaseService] Deleted recurring series:', parentEventId);
      }
      return result.success;
    } catch (error) {
      console.error('❌ [SupabaseService] Exception deleting recurring series:', error);
      return false;
    }
  }

  // ============================================================================
  // TASK MANAGEMENT METHODS
  // ============================================================================

  /**
   * Create a new task in the user's schema
   */
  async createTask(
    userId: string,
    taskData: {
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
    },
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<any> {
    try {
      // Handle category using helper method
      const categoryId = await this.resolveCategoryId(userId, taskData.category, taskData.category_id);

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

      // Log activity
      await this.logActivity(
        userId,
        'task',
        data.id,
        taskData.title,
        'create',
        null,
        options?.source || 'user',
        options?.agentType || null
      );

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
        // Strip emoji and do case-insensitive matching
        const normalizedCategory = filters.category.replace(/[\p{Emoji}\s]+/gu, '').trim().toLowerCase();
        filteredTasks = filteredTasks.filter((t: any) => {
          const categoryName = (t.category_name || t.category || '').toLowerCase();
          return categoryName === normalizedCategory || categoryName.includes(normalizedCategory);
        });
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
      interactionType: 'yes_no' | 'multiple_choice' | 'confirmation' | 'choice';
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
          console.warn('[SUPABASE SERVICE] Duplicate interaction ignored:', interaction.question);
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
   * Filters out interactions for deleted entities and removes duplicates
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

      if (!data || data.length === 0) {
        return [];
      }

      // Get all entity IDs that need validation
      const taskIds = new Set<string>();
      const eventIds = new Set<string>();
      const goalIds = new Set<string>();

      for (const interaction of data) {
        const entityId = interaction.entity_id;
        const actionType = interaction.metadata?.actionType;

        if (!entityId) continue;

        // Categorize by action type
        if (actionType === 'schedule_task_focus' || actionType === 'fill_gap') {
          taskIds.add(entityId);
        } else if (actionType === 'prepare_event') {
          eventIds.add(entityId);
        } else if (actionType === 'schedule_goal_activity') {
          goalIds.add(entityId);
        }
      }

      // Fetch existing entities to validate
      const existingTaskIds = new Set<string>();
      const existingEventIds = new Set<string>();
      const existingGoalIds = new Set<string>();

      // Check which tasks still exist
      if (taskIds.size > 0) {
        const { data: tasks } = await this.client
          .from('tasks')
          .select('id')
          .eq('user_id', userId)
          .in('id', Array.from(taskIds));

        if (tasks) {
          tasks.forEach((t: any) => existingTaskIds.add(t.id));
        }
      }

      // Check which events still exist
      if (eventIds.size > 0) {
        const { data: events } = await this.client
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .in('id', Array.from(eventIds));

        if (events) {
          events.forEach((e: any) => existingEventIds.add(e.id));
        }
      }

      // Check which goals still exist
      if (goalIds.size > 0) {
        const { data: goals } = await this.client
          .from('goals')
          .select('id')
          .eq('user_id', userId)
          .in('id', Array.from(goalIds));

        if (goals) {
          goals.forEach((g: any) => existingGoalIds.add(g.id));
        }
      }

      // Filter out interactions for deleted entities and track seen entities to prevent duplicates
      const seenEntityKeys = new Set<string>();
      const interactionsToDelete: string[] = [];

      const validInteractions = data.filter((interaction: any) => {
        const entityId = interaction.entity_id;
        const actionType = interaction.metadata?.actionType;

        // If no entity_id, keep the interaction
        if (!entityId) return true;

        // Check if entity still exists based on action type
        let entityExists = true;
        if (actionType === 'schedule_task_focus' || actionType === 'fill_gap') {
          entityExists = existingTaskIds.has(entityId);
        } else if (actionType === 'prepare_event') {
          entityExists = existingEventIds.has(entityId);
        } else if (actionType === 'schedule_goal_activity') {
          entityExists = existingGoalIds.has(entityId);
        }

        // Mark for deletion if entity doesn't exist
        if (!entityExists) {
          console.log(`[SUPABASE SERVICE] Filtering out interaction for deleted entity: ${actionType}:${entityId}`);
          interactionsToDelete.push(interaction.id);
          return false;
        }

        // Check for duplicates - only keep the first (oldest) interaction per entity+actionType
        const entityKey = `${actionType}:${entityId}`;
        if (seenEntityKeys.has(entityKey)) {
          console.log(`[SUPABASE SERVICE] Filtering out duplicate interaction: ${entityKey}`);
          interactionsToDelete.push(interaction.id);
          return false;
        }
        seenEntityKeys.add(entityKey);

        return true;
      });

      // Clean up invalid/duplicate interactions in the background (don't await)
      if (interactionsToDelete.length > 0) {
        (async () => {
          try {
            await this.client
              .from('user_interactions')
              .update({ status: 'expired' })
              .in('id', interactionsToDelete);
            console.log(`[SUPABASE SERVICE] Marked ${interactionsToDelete.length} stale interactions as expired`);
          } catch (err) {
            console.warn('[SUPABASE SERVICE] Failed to clean up stale interactions:', err);
          }
        })();
      }

      return validInteractions;
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
      // Validate interactionId format
      if (!this.isValidUUID(interactionId)) {
        console.error('❌ [SUPABASE SERVICE] Invalid UUID:', interactionId);
        return null;
      }

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
      // Validate interactionId format
      if (!this.isValidUUID(interactionId)) {
        console.error('❌ [SUPABASE SERVICE] Invalid UUID:', interactionId);
        return null;
      }

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
   * Update a single interaction status
   */
  async updateInteractionStatus(interactionId: string, status: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('user_interactions')
        .update({ status })
        .eq('id', interactionId);

      if (error) {
        console.error('❌ [SUPABASE SERVICE] Error updating interaction status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception updating interaction status:', error);
      return false;
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    userId: string,
    taskId: string,
    updates: {
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
    },
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<any> {
    try {
      // Validate taskId format
      if (!this.isValidUUID(taskId)) {
        const error = new Error(`Invalid task ID format: "${taskId}" is not a valid UUID`);
        console.error('❌ [SUPABASE SERVICE] Invalid UUID:', taskId);
        throw error;
      }

      console.log('🔄 [SUPABASE SERVICE] Updating task:', taskId);

      // Fetch old task for change tracking
      const { data: oldTask } = await this.client
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

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

      // Handle category using helper method
      if (updates.category_id !== undefined || updates.category !== undefined) {
        updateData.category_id = await this.resolveCategoryId(userId, updates.category, updates.category_id);
        if (updates.category) updateData.category = updates.category; // Backward compatibility
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

      // Log activity with changes
      const changes = this.computeChanges(
        oldTask,
        updateData,
        ['title', 'description', 'due_date', 'priority', 'status', 'category', 'category_id']
      );
      await this.logActivity(
        userId,
        'task',
        taskId,
        data.title || oldTask?.title,
        'update',
        changes,
        options?.source || 'user',
        options?.agentType || null
      );

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
  async deleteTask(
    userId: string,
    taskId: string,
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<{ success: boolean, error: string | null }> {
    // Fetch task title before deletion for logging
    const { data: task } = await this.client
      .from('tasks')
      .select('title')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    const result = await this.deleteRecord('tasks', userId, taskId, 'task');

    if (result.success) {
      await this.logActivity(
        userId,
        'task',
        taskId,
        task?.title || 'Unknown Task',
        'delete',
        null,
        options?.source || 'user',
        options?.agentType || null
      );
    }

    return result;
  }

  /**
   * Complete a task with optional notes
   */
  async completeTask(
    userId: string,
    taskId: string,
    notes?: string,
    actualDuration?: number,
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<any> {
    try {
      // Validate taskId format
      if (!this.isValidUUID(taskId)) {
        const error = new Error(`Invalid task ID format: "${taskId}" is not a valid UUID`);
        console.error('❌ [SUPABASE SERVICE] Invalid UUID:', taskId);
        throw error;
      }

      // Fetch old task for change tracking
      const { data: oldTask } = await this.client
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

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

      // Log activity
      await this.logActivity(
        userId,
        'task',
        taskId,
        data.title || oldTask?.title,
        'complete',
        { status: { old: oldTask?.status || 'pending', new: 'completed' } },
        options?.source || 'user',
        options?.agentType || null
      );

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
  async createGoal(
    userId: string,
    goalData: {
      title: string;
      description?: string;
      category?: string;
      category_id?: string;
      targetDate?: string;
      status?: 'active' | 'completed' | 'paused' | 'abandoned';
      progress?: number;
      milestones?: any[];
      milestoneType?: 'dated' | 'ordered';
      goalType?: 'SMART' | 'OKR' | 'milestone' | 'habit' | 'project';
      parentGoalId?: string;
      keyResults?: any[];
      blockers?: any[];
      resourcesNeeded?: any[];
      reflectionPrompts?: Record<string, any>;
      priorityScore?: number;
      energyRequirement?: 'low' | 'medium' | 'high';
      reviewFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    },
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<any> {
    try {
      console.log('[SUPABASE SERVICE] Creating goal for user:', userId);

      // Handle category using helper method
      const categoryId = await this.resolveCategoryId(userId, goalData.category, goalData.category_id);

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
          milestone_type: goalData.milestoneType || 'dated',
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

      // Log activity
      await this.logActivity(
        userId,
        'goal',
        data.id,
        goalData.title,
        'create',
        null,
        options?.source || 'user',
        options?.agentType || null
      );

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
        // Strip emoji and do case-insensitive matching
        const normalizedCategory = filters.category.replace(/[\p{Emoji}\s]+/gu, '').trim().toLowerCase();
        filteredGoals = filteredGoals.filter((g: any) => {
          const categoryName = (g.category_name || g.category || '').toLowerCase();
          return categoryName === normalizedCategory || categoryName.includes(normalizedCategory);
        });
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

      // Map category_name to category for frontend compatibility
      return filteredGoals.map((g: any) => ({
        ...g,
        category: g.category_name || g.category  // Use category_name from RPC, fallback to category
      }));
    } catch (error) {
      console.error('❌ [SUPABASE SERVICE] Exception getting goals:', error);
      return [];
    }
  }

  /**
   * Update a goal
   */
  async updateGoal(
    userId: string,
    goalId: string,
    updates: {
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
    },
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<any> {
    try {
      // Validate goalId format
      if (!this.isValidUUID(goalId)) {
        const error = new Error(`Invalid goal ID format: "${goalId}" is not a valid UUID`);
        console.error('❌ [SUPABASE SERVICE] Invalid UUID:', goalId);
        throw error;
      }

      console.log('🔄 [SUPABASE SERVICE] Updating goal:', goalId);

      // Fetch old goal for change tracking
      const { data: oldGoal } = await this.client
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', userId)
        .single();

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

      // Handle category using helper method
      if (updates.category_id !== undefined || updates.category !== undefined) {
        updateData.category_id = await this.resolveCategoryId(userId, updates.category, updates.category_id);
        if (updates.category) updateData.category = updates.category; // Backward compatibility
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

      // Log activity with changes
      const changes = this.computeChanges(
        oldGoal,
        updateData,
        ['title', 'description', 'target_date', 'status', 'progress', 'category', 'category_id']
      );
      await this.logActivity(
        userId,
        'goal',
        goalId,
        data.title || oldGoal?.title,
        'update',
        changes,
        options?.source || 'user',
        options?.agentType || null
      );

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
  async deleteGoal(
    userId: string,
    goalId: string,
    options?: { source?: ActivitySource; agentType?: string }
  ): Promise<{ success: boolean, error: string | null }> {
    // Fetch goal title before deletion for logging
    const { data: goal } = await this.client
      .from('goals')
      .select('title')
      .eq('id', goalId)
      .eq('user_id', userId)
      .single();

    const result = await this.deleteRecord('goals', userId, goalId, 'goal');

    if (result.success) {
      await this.logActivity(
        userId,
        'goal',
        goalId,
        goal?.title || 'Unknown Goal',
        'delete',
        null,
        options?.source || 'user',
        options?.agentType || null
      );
    }

    return result;
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

  // ============================================================================
  // LIFE PLAN MANAGEMENT METHODS
  // ============================================================================

  /**
   * Get the active life plan for a user
   */
  async getPlan(userId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('life_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user has no plan yet
          return null;
        }
        console.error('Error fetching plan:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception fetching plan:', error);
      return null;
    }
  }

  /**
   * Create a new life plan for a user
   */
  async createPlan(userId: string, planData: {
    title?: string;
    content?: string;
    horizonStart?: string;
    horizonEnd?: string;
    status?: 'draft' | 'active' | 'archived';
  }): Promise<any | null> {
    try {
      // Archive any existing active plan
      await this.client
        .from('life_plans')
        .update({ status: 'archived' })
        .eq('user_id', userId)
        .eq('status', 'active');

      const { data, error } = await this.client
        .from('life_plans')
        .insert({
          user_id: userId,
          title: planData.title || 'My Life Plan',
          content: planData.content || '',
          horizon_start: planData.horizonStart,
          horizon_end: planData.horizonEnd,
          status: planData.status || 'active'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating plan:', error);
        return null;
      }

      console.log('Plan created:', data.id);
      return data;
    } catch (error) {
      console.error('Exception creating plan:', error);
      return null;
    }
  }

  /**
   * Update a life plan
   */
  async updatePlan(userId: string, planId: string, updates: {
    title?: string;
    content?: string;
    horizonStart?: string;
    horizonEnd?: string;
    status?: 'draft' | 'active' | 'archived';
  }): Promise<any | null> {
    try {
      if (!this.isValidUUID(planId)) {
        console.error('Invalid plan ID:', planId);
        return null;
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.horizonStart !== undefined) updateData.horizon_start = updates.horizonStart;
      if (updates.horizonEnd !== undefined) updateData.horizon_end = updates.horizonEnd;
      if (updates.status !== undefined) updateData.status = updates.status;

      const { data, error } = await this.client
        .from('life_plans')
        .update(updateData)
        .eq('id', planId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating plan:', error);
        return null;
      }

      console.log('Plan updated:', planId);
      return data;
    } catch (error) {
      console.error('Exception updating plan:', error);
      return null;
    }
  }

  /**
   * Delete a life plan
   */
  async deletePlan(userId: string, planId: string): Promise<{ success: boolean; error: string | null }> {
    return this.deleteRecord('life_plans', userId, planId, 'plan');
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
