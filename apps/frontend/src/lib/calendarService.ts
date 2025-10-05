import { User } from '@supabase/supabase-js'
import { post } from './apiClient'

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
  startDate?: Date,
  endDate?: Date
): Promise<{ events: CalendarEvent[], error: string | null }> {
  try {
    if (!user) {
      return { events: [], error: 'User not authenticated' }
    }

    // Use the backend API instead of direct Supabase calls
    const response = await post<{ success?: boolean; events?: CalendarEvent[]; error?: string }>(
      '/api/events',
      {
        user_id: user.id,
        start_date: startDate ? startDate.toISOString() : null,
        end_date: endDate ? endDate.toISOString() : null
      }
    )

    if (!response.ok) {
      return { events: [], error: response.error || 'Failed to fetch events from backend' }
    }

    if (response.data?.success) {
      return { events: response.data.events ?? [], error: null }
    }

    return { events: [], error: response.data?.error || 'Unknown error' }
  } catch (err: any) {
    console.error('Unexpected error in fetchUserEvents:', err)
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
  event: Omit<CalendarEvent, 'id' | 'event_created_at' | 'event_updated_at'>
): Promise<{ event: CalendarEvent | null, error: string | null }> {
  try {
    if (!user) {
      return { event: null, error: 'User not authenticated' }
    }

    // Use the correct endpoint for creating events
    const response = await post<{ success?: boolean; event?: CalendarEvent; error?: string }>(
      '/api/events/create',
      {
        user_id: user.id,
        ...event
      }
    )

    if (!response.ok) {
      return { event: null, error: response.error || 'Failed to create event' }
    }

    if (!response.data?.success || !response.data.event) {
      console.error('Error creating event:', response.data?.error)
      return { event: null, error: response.data?.error || 'Failed to create event' }
    }

    return { event: response.data.event, error: null };

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
  event: Partial<Omit<CalendarEvent, 'id' | 'event_created_at' | 'event_updated_at'>>
): Promise<{ event: CalendarEvent | null, error: string | null }> {
  try {
    if (!user) {
      return { event: null, error: 'User not authenticated' };
    }

    // Use the correct endpoint for updating events
    const response = await post<{ success?: boolean; event?: CalendarEvent; error?: string }>(
      '/api/events/update',
      {
        user_id: user.id,
        event_id: eventId,
        ...event
      }
    )

    if (!response.ok) {
      return { event: null, error: response.error || 'Failed to update event' }
    }

    if (!response.data?.success || !response.data.event) {
      console.error('Error updating event:', response.data?.error)
      return { event: null, error: response.data?.error || 'Failed to update event' }
    }

    return { event: response.data.event, error: null };
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
  eventId: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Use the backend API instead of direct RPC calls
    const response = await post<{ success?: boolean; error?: string }>(
      '/api/events/delete',
      {
        user_id: user.id,
        event_id: eventId
      }
    )

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to delete event' };
    }

    if (response.data?.success) {
      return { success: true, error: null };
    }

    return { success: false, error: response.data?.error || 'Unknown error' };
  } catch (err: any) {
    console.error('Unexpected error in deleteEvent:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}

