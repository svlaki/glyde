import { User } from '@supabase/supabase-js'
import { trackEvent } from './analytics'

export interface Aspect {
  id: string
  user_id: string
  name: string
  color: string
  icon?: string
  description?: string
  context?: Record<string, any>
  display_order?: number
  visibility?: 'private' | 'shared'
  member_role?: 'owner' | 'member' | 'viewer'
  archived_at?: string | null
  created_at?: string
  updated_at?: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchUserAspects(
  user: User,
  accessToken?: string
): Promise<{ aspects: Aspect[], error: string | null }> {
  try {
    if (!user) {
      return { aspects: [], error: 'User not authenticated' }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/aspects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { aspects: [], error: data.error || 'Failed to fetch aspects' }
    }

    return { aspects: data.aspects || [], error: null }
  } catch (error) {
    console.error('Error fetching aspects:', error)
    return { aspects: [], error: 'Failed to fetch aspects' }
  }
}

export async function createUserAspect(
  user: User,
  aspectData: {
    name: string
    color: string
    icon?: string
    description?: string
    context?: Record<string, any>
  },
  accessToken?: string
): Promise<{ aspect: Aspect | null, error: string | null }> {
  try {
    if (!user) {
      return { aspect: null, error: 'User not authenticated' }
    }

    if (!aspectData.name || !aspectData.color) {
      return { aspect: null, error: 'Name and color are required' }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/aspects/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        ...aspectData
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { aspect: null, error: data.error || 'Failed to create aspect' }
    }

    trackEvent('aspect_created', 'engagement', { aspect_id: data.aspect?.id })
    return { aspect: data.aspect, error: null }
  } catch (error) {
    console.error('Error creating aspect:', error)
    return { aspect: null, error: 'Failed to create aspect' }
  }
}

export async function updateUserAspect(
  user: User,
  aspectId: string,
  updates: Partial<Aspect>,
  accessToken?: string
): Promise<{ aspect: Aspect | null, error: string | null }> {
  try {
    if (!user) {
      return { aspect: null, error: 'User not authenticated' }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/aspects/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        aspect_id: aspectId,
        ...updates
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { aspect: null, error: data.error || 'Failed to update aspect' }
    }

    return { aspect: data.aspect, error: null }
  } catch (error) {
    console.error('Error updating aspect:', error)
    return { aspect: null, error: 'Failed to update aspect' }
  }
}

export async function archiveUserAspect(
  user: User,
  aspectId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/aspects/archive`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        aspect_id: aspectId
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to archive aspect' }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Error archiving aspect:', error)
    return { success: false, error: 'Failed to archive aspect' }
  }
}

export async function unarchiveUserAspect(
  user: User,
  aspectId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/aspects/unarchive`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        aspect_id: aspectId
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to unarchive aspect' }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Error unarchiving aspect:', error)
    return { success: false, error: 'Failed to unarchive aspect' }
  }
}

export async function fetchArchivedAspects(
  user: User,
  accessToken?: string
): Promise<{ aspects: Aspect[], error: string | null }> {
  try {
    if (!user) {
      return { aspects: [], error: 'User not authenticated' }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/aspects/archived`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { aspects: [], error: data.error || 'Failed to fetch archived aspects' }
    }

    return { aspects: data.aspects || [], error: null }
  } catch (error) {
    console.error('Error fetching archived aspects:', error)
    return { aspects: [], error: 'Failed to fetch archived aspects' }
  }
}

export async function deleteUserAspect(
  user: User,
  aspectId: string,
  accessToken?: string
): Promise<{ success: boolean, message?: string, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/api/aspects/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        aspect_id: aspectId
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete aspect' }
    }

    return {
      success: data.success,
      message: data.message,
      error: null
    }
  } catch (error) {
    console.error('Error deleting aspect:', error)
    return { success: false, error: 'Failed to delete aspect' }
  }
}
