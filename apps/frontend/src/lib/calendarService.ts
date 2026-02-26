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
  // Old aspect fields (deprecated but kept for backward compatibility)
  aspect?: string
  color?: string
  // New aspect fields from unified aspect system
  aspect_id?: string
  aspect_name?: string
  aspect_color?: string
  aspect_icon?: string
  // Recurring event fields
  recurrence_rule?: string
  recurrence_end?: string
  parent_event_id?: string
  is_recurring?: boolean
  is_instance?: boolean
  instance_date?: string
  // Visibility settings
  visibility?: 'private' | 'friends' | 'public' | 'shared'
  // Shared event metadata
  user_role?: 'owner' | 'editor' | 'viewer'
  member_count?: number
  // Post-event metadata
  reflection?: string
  is_missed?: boolean
  // Reminder field
  reminder_minutes?: number | null  // Minutes before event to fire a reminder (null = no reminder)
  // Google sync fields
  google_event_id?: string
  local_notes?: string
  // Project fields
  project_id?: string
  project_name?: string
  // Shared aspect flag
  is_shared?: boolean
  // Friend event fields (when viewing friend's event)
  is_friend_event?: boolean
  owner_display_name?: string
  owner_avatar_url?: string
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
  endDate?: Date,
  options?: { raw?: boolean }
): Promise<{ events: CalendarEvent[], error: string | null }> {
  try {
    if (!user) {
      console.error('[calendarService] No user provided');
      return { events: [], error: 'User not authenticated' }
    }

    const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events`;
    const body: Record<string, unknown> = {
      user_id: user.id,
      start_date: startDate ? startDate.toISOString() : null,
      end_date: endDate ? endDate.toISOString() : null,
    };
    if (options?.raw) {
      body.raw = true;
    }

    console.log('[calendarService] Fetching events:', { url, body });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store'
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

/**
 * Fetch expanded events (with recurring events expanded into instances)
 * @param user The authenticated user
 * @param startDate Optional start date to filter events
 * @param endDate Optional end date to filter events
 * @returns Array of calendar events with recurring events expanded
 */
export async function fetchExpandedEvents(
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

    const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events/expanded`;
    const body = {
      user_id: user.id,
      start_date: startDate ? startDate.toISOString() : null,
      end_date: endDate ? endDate.toISOString() : null
    };

    console.log('[calendarService] Fetching expanded events:', { url, body });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    console.log('[calendarService] Response status:', response.status, response.ok);

    if (!response.ok) {
      console.error('[calendarService] Failed to fetch expanded events:', response.status);
      return { events: [], error: 'Failed to fetch expanded events from backend' }
    }

    const data = await response.json();

    console.log('[calendarService] Response data:', { success: data.success, eventCount: data.events?.length });

    if (data.success) {
      return { events: data.events || [], error: null }
    } else {
      console.error('[calendarService] API returned error:', data.error);
      return { events: [], error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[calendarService] Exception in fetchExpandedEvents:', err)
    return { events: [], error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Create a recurring event
 * @param user The authenticated user
 * @param title Event title
 * @param startTime Start time in ISO format
 * @param recurrenceRule RFC 5545 RRULE format
 * @param aspect Optional aspect
 * @param description Optional description
 * @param location Optional location
 * @param recurrenceEnd Optional end date for recurrence
 * @returns The created recurring event or error
 */
export async function createRecurringEvent(
  user: User,
  title: string,
  startTime: string,
  recurrenceRule: string,
  aspect?: string,
  description?: string,
  location?: string,
  recurrenceEnd?: string,
  accessToken?: string,
  reminderMinutes?: number | null
): Promise<{ event: CalendarEvent | null, error: string | null }> {
  try {
    if (!user) {
      return { event: null, error: 'User not authenticated' }
    }

    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${agentServiceUrl}/api/events/create-recurring`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        title,
        start_time: startTime,
        recurrence_rule: recurrenceRule,
        aspect: aspect || 'Personal',
        description: description || '',
        location: location || '',
        recurrence_end: recurrenceEnd || null,
        reminder_minutes: reminderMinutes ?? null
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Agent service error: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success) {
      console.error('Error creating recurring event:', data.error)
      return { event: null, error: data.error }
    }

    return { event: data.event, error: null };

  } catch (err: any) {
    console.error('Unexpected error in createRecurringEvent:', err)
    return { event: null, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Update a recurring event series or single instance
 * @param user The authenticated user
 * @param eventId The ID of the event to update
 * @param scope 'entire_series' or 'this_instance'
 * @param updates The fields to update
 * @returns The updated event or error
 */
export async function updateRecurringEvent(
  user: User,
  eventId: string,
  scope: 'entire_series' | 'this_instance',
  updates: Partial<Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>>,
  accessToken?: string
): Promise<{ event: CalendarEvent | null, error: string | null }> {
  try {
    if (!user) {
      return { event: null, error: 'User not authenticated' };
    }

    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${agentServiceUrl}/api/events/update-recurring`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        event_id: eventId,
        scope,
        ...updates
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Agent service error: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success) {
      console.error('Error updating recurring event:', data.error);
      return { event: null, error: data.error };
    }

    return { event: data.event, error: null };
  } catch (err: any) {
    console.error('Unexpected error in updateRecurringEvent:', err);
    return { event: null, error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Delete a recurring event series or single instance
 * @param user The authenticated user
 * @param eventId The ID of the event to delete
 * @param scope 'entire_series' or 'this_instance'
 * @returns Success boolean or error
 */
export async function deleteRecurringEvent(
  user: User,
  eventId: string,
  scope: 'entire_series' | 'this_instance' = 'entire_series',
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${agentServiceUrl}/api/events/delete-recurring`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        event_id: eventId,
        scope
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
    console.error('Unexpected error in deleteRecurringEvent:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}

// Calendar Integration Functions for Onboarding

export interface AnalysisStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
}

export async function getGoogleAuthUrl(
  user: User,
  accessToken: string
): Promise<{ success: boolean; authUrl?: string; state?: string; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
    const response = await fetch(`${API_URL}/api/calendar/google/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id })
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to get Google auth URL' }
    }

    return { success: true, authUrl: data.authUrl, state: data.state }
  } catch (error) {
    console.error('Error getting Google auth URL:', error)
    return { success: false, error: 'Failed to get Google auth URL' }
  }
}

export async function importGoogleCalendar(
  user: User,
  accessToken: string,
  code: string,
  state: string
): Promise<{ success: boolean; eventCount?: number; analysisJobId?: string; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    // First, handle callback to get access token
    const callbackResponse = await fetch(`${API_URL}/api/calendar/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        code,
        state
      })
    })

    const callbackData = await callbackResponse.json()

    if (!callbackResponse.ok) {
      return { success: false, error: callbackData.error || 'Failed to connect Google Calendar' }
    }

    // Now import events
    const importResponse = await fetch(`${API_URL}/api/calendar/google/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        accessToken: callbackData.accessToken
      })
    })

    const importData = await importResponse.json()

    if (!importResponse.ok) {
      return { success: false, error: importData.error || 'Failed to import Google Calendar' }
    }

    return {
      success: true,
      eventCount: importData.eventCount,
      analysisJobId: importData.analysisJobId
    }
  } catch (error) {
    console.error('Error importing Google Calendar:', error)
    return { success: false, error: 'Failed to import Google Calendar' }
  }
}

export async function getMicrosoftAuthUrl(
  user: User,
  accessToken: string
): Promise<{ success: boolean; authUrl?: string; state?: string; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
    const response = await fetch(`${API_URL}/api/calendar/microsoft/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id })
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to get Microsoft auth URL' }
    }

    return { success: true, authUrl: data.authUrl, state: data.state }
  } catch (error) {
    console.error('Error getting Microsoft auth URL:', error)
    return { success: false, error: 'Failed to get Microsoft auth URL' }
  }
}

export async function importMicrosoftCalendar(
  user: User,
  accessToken: string,
  code: string,
  state: string
): Promise<{ success: boolean; eventCount?: number; analysisJobId?: string; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

    // First, handle callback to get access token
    const callbackResponse = await fetch(`${API_URL}/api/calendar/microsoft/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        code,
        state
      })
    })

    const callbackData = await callbackResponse.json()

    if (!callbackResponse.ok) {
      return { success: false, error: callbackData.error || 'Failed to connect Microsoft Calendar' }
    }

    // Now import events
    const importResponse = await fetch(`${API_URL}/api/calendar/microsoft/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        accessToken: callbackData.accessToken
      })
    })

    const importData = await importResponse.json()

    if (!importResponse.ok) {
      return { success: false, error: importData.error || 'Failed to import Microsoft Calendar' }
    }

    return {
      success: true,
      eventCount: importData.eventCount,
      analysisJobId: importData.analysisJobId
    }
  } catch (error) {
    console.error('Error importing Microsoft Calendar:', error)
    return { success: false, error: 'Failed to import Microsoft Calendar' }
  }
}

export async function uploadICSFile(
  user: User,
  accessToken: string,
  file: File
): Promise<{ success: boolean; eventCount?: number; analysisJobId?: string; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_URL}/api/calendar/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to upload calendar file' }
    }

    return {
      success: true,
      eventCount: data.eventCount,
      analysisJobId: data.analysisJobId
    }
  } catch (error) {
    console.error('Error uploading calendar file:', error)
    return { success: false, error: 'Failed to upload calendar file' }
  }
}

export async function getAnalysisStatus(
  user: User,
  accessToken: string,
  jobId: string
): Promise<{ success: boolean; data?: AnalysisStatus; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
    const response = await fetch(`${API_URL}/api/calendar/analysis/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to get analysis status' }
    }

    return {
      success: true,
      data: {
        status: result.status,
        progress: result.progress,
        result: result.result,
        error: result.error
      }
    }
  } catch (error) {
    console.error('Error getting analysis status:', error)
    return { success: false, error: 'Failed to get analysis status' }
  }
}

/**
 * Fetch friends' visible events
 */
export async function fetchFriendsEvents(
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

    const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events/friends`;
    const body = {
      user_id: user.id,
      start_date: startDate ? startDate.toISOString() : null,
      end_date: endDate ? endDate.toISOString() : null
    };

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('[calendarService] Failed to fetch friends events:', response.status);
      return { events: [], error: 'Failed to fetch friends events' }
    }

    const data = await response.json();
    return { events: data.events || [], error: null };
  } catch (error) {
    console.error('[calendarService] Error fetching friends events:', error);
    return { events: [], error: 'Network error' }
  }
}

/**
 * Toggle friend event visibility
 */
export async function toggleFriendEventVisibility(
  userId: string,
  friendId: string,
  showEvents: boolean,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    const url = `${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/friends/${friendId}/visibility`;
    const body = {
      user_id: userId,
      showEvents
    };

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error('[calendarService] Failed to toggle visibility:', response.status);
      return { success: false, error: 'Failed to toggle visibility' }
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('[calendarService] Error toggling visibility:', error);
    return { success: false, error: 'Network error' }
  }
}

