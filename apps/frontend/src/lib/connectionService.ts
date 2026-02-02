import { User } from '@supabase/supabase-js'

export interface Connection {
  id: string
  provider: 'google' | 'microsoft'
  provider_account_id: string | null
  calendar_name: string | null
  sync_status: 'pending' | 'syncing' | 'synced' | 'error'
  sync_error: string | null
  last_synced_at: string | null
  is_active: boolean
  connected_at: string
}

export interface CalendarMapping {
  id: string
  user_id: string
  connection_id: string
  google_calendar_id: string
  google_calendar_name: string | null
  google_calendar_color: string | null
  is_primary: boolean
  category_id: string | null
  is_synced: boolean
  is_visible: boolean
  sync_token: string | null
  last_synced_at: string | null
}

export interface GoogleCalendar {
  id: string
  summary: string
  description: string | null
  backgroundColor: string | null
  foregroundColor: string | null
  primary: boolean
  accessRole: string
  timeZone: string | null
}

const getApiUrl = () => import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

/**
 * Fetch all connections for the authenticated user
 */
export async function fetchConnections(
  user: User,
  accessToken?: string
): Promise<{ connections: Connection[], error: string | null }> {
  try {
    if (!user) {
      console.error('[connectionService] No user provided')
      return { connections: [], error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: user.id }),
      cache: 'no-store'
    })

    if (!response.ok) {
      console.error('[connectionService] Failed to fetch connections:', response.status)
      return { connections: [], error: 'Failed to fetch connections from backend' }
    }

    const data = await response.json()

    if (data.success) {
      return { connections: data.connections || [], error: null }
    } else {
      return { connections: [], error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in fetchConnections:', err)
    return { connections: [], error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Get Google OAuth URL for connecting a calendar
 */
export async function getGoogleAuthUrl(
  user: User,
  accessToken?: string
): Promise<{ authUrl: string | null, error: string | null }> {
  try {
    if (!user) {
      return { authUrl: null, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/google/auth`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: user.id })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { authUrl: null, error: data.error || 'Failed to get auth URL' }
    }

    const data = await response.json()

    if (data.success && data.authUrl) {
      return { authUrl: data.authUrl, error: null }
    } else {
      return { authUrl: null, error: data.error || 'Failed to generate auth URL' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in getGoogleAuthUrl:', err)
    return { authUrl: null, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Handle Google OAuth callback - exchange code for tokens
 */
export async function handleGoogleCallback(
  user: User,
  code: string,
  state: string,
  accessToken?: string
): Promise<{ connection: Connection | null, error: string | null }> {
  try {
    if (!user) {
      return { connection: null, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/google/callback`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        code,
        state
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { connection: null, error: data.error || 'Failed to connect Google Calendar' }
    }

    const data = await response.json()

    if (data.success) {
      return { connection: data.connection, error: null }
    } else {
      return { connection: null, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in handleGoogleCallback:', err)
    return { connection: null, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Trigger a manual sync for a connection
 */
export async function triggerSync(
  user: User,
  connectionId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/sync`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        connection_id: connectionId
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { success: false, error: data.error || 'Failed to trigger sync' }
    }

    const data = await response.json()

    if (data.success) {
      return { success: true, error: null }
    } else {
      return { success: false, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in triggerSync:', err)
    return { success: false, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Disconnect (delete) a connection
 */
export async function disconnectConnection(
  user: User,
  connectionId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/disconnect`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        connection_id: connectionId
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { success: false, error: data.error || 'Failed to disconnect' }
    }

    const data = await response.json()

    if (data.success) {
      return { success: true, error: null }
    } else {
      return { success: false, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in disconnectConnection:', err)
    return { success: false, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Fetch Google Calendar list for a connection
 */
export async function fetchCalendarList(
  user: User,
  connectionId: string,
  accessToken?: string
): Promise<{ calendars: GoogleCalendar[], error: string | null }> {
  try {
    if (!user) {
      return { calendars: [], error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/calendars`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        connection_id: connectionId
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { calendars: [], error: data.error || 'Failed to fetch calendars' }
    }

    const data = await response.json()

    if (data.success) {
      return { calendars: data.calendars || [], error: null }
    } else {
      return { calendars: [], error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in fetchCalendarList:', err)
    return { calendars: [], error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Fetch calendar mappings for a connection
 */
export async function fetchCalendarMappings(
  user: User,
  connectionId: string,
  accessToken?: string
): Promise<{ mappings: CalendarMapping[], error: string | null }> {
  try {
    if (!user) {
      return { mappings: [], error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/calendars/mappings`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        connection_id: connectionId
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { mappings: [], error: data.error || 'Failed to fetch calendar mappings' }
    }

    const data = await response.json()

    if (data.success) {
      return { mappings: data.mappings || [], error: null }
    } else {
      return { mappings: [], error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in fetchCalendarMappings:', err)
    return { mappings: [], error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Sync calendar list from Google (creates/updates mappings)
 */
export async function syncCalendarList(
  user: User,
  connectionId: string,
  accessToken?: string
): Promise<{ mappings: CalendarMapping[], error: string | null }> {
  try {
    if (!user) {
      return { mappings: [], error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/calendars/sync`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        connection_id: connectionId
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { mappings: [], error: data.error || 'Failed to sync calendars' }
    }

    const data = await response.json()

    if (data.success) {
      return { mappings: data.mappings || [], error: null }
    } else {
      return { mappings: [], error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in syncCalendarList:', err)
    return { mappings: [], error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Update a calendar mapping (set aspect, toggle sync, toggle visibility)
 */
export async function updateCalendarMapping(
  user: User,
  mappingId: string,
  updates: {
    category_id?: string | null
    is_synced?: boolean
    is_visible?: boolean
  },
  accessToken?: string
): Promise<{ mapping: CalendarMapping | null, error: string | null }> {
  try {
    if (!user) {
      return { mapping: null, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/connections/calendars/mapping`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        mapping_id: mappingId,
        ...updates
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { mapping: null, error: data.error || 'Failed to update calendar mapping' }
    }

    const data = await response.json()

    if (data.success) {
      return { mapping: data.mapping, error: null }
    } else {
      return { mapping: null, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[connectionService] Exception in updateCalendarMapping:', err)
    return { mapping: null, error: err.message || 'An unexpected error occurred' }
  }
}
