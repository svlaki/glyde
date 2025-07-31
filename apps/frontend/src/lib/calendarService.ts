import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface CalendarEvent {
  id: string
  event_title: string
  event_starts_at: string
  event_ends_at: string
  event_location?: string
  event_description?: string
  event_created_at?: string
  event_updated_at?: string
}

/**
 * Get the schema name for a user
 * @param user The authenticated user
 * @returns The schema name in the format u_<userId>
 */
export function getUserSchemaName(user: User): string {
  return `u_${user.id.replace(/-/g, '')}`
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
    const response = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        start_date: startDate ? startDate.toISOString() : null,
        end_date: endDate ? endDate.toISOString() : null
      })
    });

    if (!response.ok) {
      return { events: [], error: 'Failed to fetch events from backend' }
    }

    const data = await response.json();
    
    if (data.success) {
      return { events: data.events || [], error: null }
    } else {
      return { events: [], error: data.error || 'Unknown error' }
    }
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

    // Use the agent service for embedding generation
    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
    const response = await fetch(`${agentServiceUrl}/api/embeddings/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        event: event
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
  event: Partial<Omit<CalendarEvent, 'id' | 'event_created_at' | 'event_updated_at'>>
): Promise<{ event: CalendarEvent | null, error: string | null }> {
  try {
    if (!user) {
      return { event: null, error: 'User not authenticated' };
    }

    // Use the agent service for embedding generation
    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
    const response = await fetch(`${agentServiceUrl}/api/embeddings/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        event: { ...event, id: eventId }
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
  eventId: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const schemaName = getUserSchemaName(user);

    const { data, error } = await supabase.rpc('delete_user_event', {
      user_schema: schemaName,
      event_id: eventId,
    });

    if (error) {
      console.error('Error deleting event:', error);
      return { success: false, error: error.message };
    }

    return { success: data, error: null };
  } catch (err: any) {
    console.error('Unexpected error in deleteEvent:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Generate sample events for development/testing
 * @returns Array of sample calendar events
 */
function generateSampleEvents(): CalendarEvent[] {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  
  // Create copies to avoid modifying the same date object
  const todayStart = new Date(today)
  const todayEnd = new Date(today)
  const tomorrowStart = new Date(tomorrow)
  const tomorrowEnd = new Date(tomorrow)
  const nextWeekStart = new Date(nextWeek)
  const nextWeekEnd = new Date(nextWeek)
  
  return [
    {
      id: '1',
      event_title: 'Sample Meeting',
      event_starts_at: new Date(todayStart.setHours(10, 0, 0, 0)).toISOString(),
      event_ends_at: new Date(todayEnd.setHours(11, 30, 0, 0)).toISOString(),
      event_location: 'Conference Room A',
      event_description: 'Weekly team sync',
      event_created_at: new Date().toISOString(),
      event_updated_at: new Date().toISOString()
    },
    {
      id: '2',
      event_title: 'Lunch with Client',
      event_starts_at: new Date(tomorrowStart.setHours(12, 0, 0, 0)).toISOString(),
      event_ends_at: new Date(tomorrowEnd.setHours(13, 30, 0, 0)).toISOString(),
      event_location: 'Downtown Cafe',
      event_description: 'Discuss project requirements',
      event_created_at: new Date().toISOString(),
      event_updated_at: new Date().toISOString()
    },
    {
      id: '3',
      event_title: 'Product Demo',
      event_starts_at: new Date(nextWeekStart.setHours(14, 0, 0, 0)).toISOString(),
      event_ends_at: new Date(nextWeekEnd.setHours(15, 0, 0, 0)).toISOString(),
      event_location: 'Virtual',
      event_description: 'Present new features to stakeholders',
      event_created_at: new Date().toISOString(),
      event_updated_at: new Date().toISOString()
    }
  ]
} 