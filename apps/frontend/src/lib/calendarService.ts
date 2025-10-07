import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface CalendarEvent {
  id: string
  user_id?: string
  title: string
  start_time: string
  end_time: string
  location?: string
  description?: string
  created_at?: string
  updated_at?: string
  category?: string
  color?: string
}

/**
 * Fetch events from the user's personal schema
 * @param user The authenticated user
 * @param startDate Optional start date to filter events
 * @param endDate Optional end date to filter events
 * @returns Array of calendar events
 */
export async function fetchUserEvents(
  user: User,
  accessToken?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ events: CalendarEvent[], error: string | null }> {
  try {
    if (!user) {
      console.error('[calendarService] No user provided');
      return { events: [], error: 'User not authenticated' }
    }

    const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events`;
    const body = {
      user_id: user.id,
      start_date: startDate ? startDate.toISOString() : null,
      end_date: endDate ? endDate.toISOString() : null
    };

    console.log('[calendarService] Fetching events:', { url, body });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    console.log('[calendarService] Response status:', response.status, response.ok);

    if (!response.ok) {
      console.error('[calendarService] Failed to fetch events:', response.status);
      return { events: [], error: 'Failed to fetch events from backend' }
    }

    const data = await response.json();
    
    console.log('[calendarService] Response data:', { success: data.success, eventCount: data.events?.length });
    console.log('[calendarService] First event:', data.events?.[0]);
    
    if (data.success) {
      return { events: data.events || [], error: null }
    } else {
      console.error('[calendarService] API returned error:', data.error);
      return { events: [], error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[calendarService] Exception in fetchUserEvents:', err)
    return { events: [], error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Create a new event in the user's schema
 * @param user The authenticated user
 * @param event The event to create
 * @returns The created event or error
 */
export async function createEvent(
  user: User,
  event: Omit<CalendarEvent, 'id' | 'event_created_at' | 'event_updated_at'>,
  accessToken?: string
): Promise<{ event: CalendarEvent | null, error: string | null }> {
  try {
    if (!user) {
      return { event: null, error: 'User not authenticated' }
    }

    // Use the correct endpoint for creating events
    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${agentServiceUrl}/api/events/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        ...event
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Agent service error: ${errorText}`)
    }
    
    const data = await response.json()

    if (!data.success) {
      console.error('Error creating event:', data.error)
      return { event: null, error: data.error }
    }

    return { event: data.event, error: null };

  } catch (err: any) {
    console.error('Unexpected error in createEvent:', err)
    return { event: null, error: err.message || 'An unexpected error occurred' }
  }
}


/**
 * Update an existing event in the user's schema
 * @param user The authenticated user
 * @param eventId The ID of the event to update
 * @param event The event data to update
 * @returns The updated event or error
 */
export async function updateEvent(
  user: User,
  eventId: string,
  event: Partial<Omit<CalendarEvent, 'id' | 'event_created_at' | 'event_updated_at'>>,
  accessToken?: string
): Promise<{ event: CalendarEvent | null, error: string | null }> {
  try {
    if (!user) {
      return { event: null, error: 'User not authenticated' };
    }

    // Use the correct endpoint for updating events
    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${agentServiceUrl}/api/events/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        event_id: eventId,
        ...event
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Agent service error: ${errorText}`)
    }
    
    const data = await response.json()

    if (!data.success) {
      console.error('Error updating event:', data.error);
      return { event: null, error: data.error };
    }

    return { event: data.event, error: null };
  } catch (err: any) {
    console.error('Unexpected error in updateEvent:', err);
    return { event: null, error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Delete an event from the user's schema
 * @param user The authenticated user
 * @param eventId The ID of the event to delete
 * @returns Success boolean or error
 */
export async function deleteEvent(
  user: User,
  eventId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Use the backend API instead of direct RPC calls
    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${agentServiceUrl}/api/events/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        event_id: eventId
      })
    });

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Backend error: ${errorText}` };
    }

    const data = await response.json();

    if (data.success) {
      return { success: true, error: null };
    } else {
      return { success: false, error: data.error || 'Unknown error' };
    }
  } catch (err: any) {
    console.error('Unexpected error in deleteEvent:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}

