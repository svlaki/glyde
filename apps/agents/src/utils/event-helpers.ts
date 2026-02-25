import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Database event type with aspect information
 */
export interface DatabaseEvent {
  id: string;
  user_id: string;
  title: string;
  start_time: string; // ISO 8601 format
  end_time: string; // ISO 8601 format
  location?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  aspect?: string; // For backward compatibility
  aspect_id?: string;
  aspect_name?: string;
  aspect_color?: string;
  aspect_icon?: string;
  // Recurring event fields
  recurrence_rule?: string;
  recurrence_end?: string;
  parent_event_id?: string;
  is_recurring?: boolean;
  is_instance?: boolean;
  instance_date?: string;
  // Calendar sync fields
  google_event_id?: string;
  outlook_event_id?: string;
  local_notes?: string;
}

/**
 * Get events with aspect data using RPC function
 * This uses the database function `get_events_with_aspects` which performs
 * the join server-side for better performance
 */
export async function getEventsWithAspects(
  client: SupabaseClient,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<DatabaseEvent[]> {
  try {
    const { data, error } = await client.rpc('get_events_with_aspects', {
      p_user_id: userId,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });

    if (error) {
      console.error('[EventHelpers] Error fetching events:', error);
      return [];
    }

    console.log('[EventHelpers] Retrieved', data?.length || 0, 'events (UTC) with aspects');

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
      aspect: event.aspect_name || 'Personal', // For backward compatibility
      aspect_id: event.aspect_id,
      aspect_name: event.aspect_name,
      aspect_color: event.aspect_color,
      aspect_icon: event.aspect_icon
    }));

    return transformedEvents;
  } catch (error) {
    console.error('[EventHelpers] Exception fetching events:', error);
    return [];
  }
}

/**
 * Get a single event by ID with aspect data
 */
export async function getEventById(
  client: SupabaseClient,
  userId: string,
  eventId: string
): Promise<DatabaseEvent | null> {
  try {
    // Get all events and filter (could be optimized with a separate RPC function)
    const events = await getEventsWithAspects(client, userId);
    const event = events.find(e => e.id === eventId);
    return event || null;
  } catch (error) {
    console.error('[EventHelpers] Exception fetching event by ID:', error);
    return null;
  }
}
