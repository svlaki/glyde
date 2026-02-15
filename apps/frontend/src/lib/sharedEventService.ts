export interface SharedEventMember {
  id: string
  event_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
  joined_at: string
  user?: {
    id: string
    email: string
    display_name: string
    avatar_url?: string
  }
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function getEventMembers(
  eventId: string,
  accessToken: string
): Promise<ApiResponse<SharedEventMember[]>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-events/${eventId}/members`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to fetch members' }
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching event members:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function addEventMember(
  eventId: string,
  userId: string,
  role: 'editor' | 'viewer',
  accessToken: string
): Promise<ApiResponse<SharedEventMember>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-events/${eventId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ userId, role })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to add member' }
    }

    return await response.json()
  } catch (error) {
    console.error('Error adding event member:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function updateEventMemberRole(
  eventId: string,
  memberId: string,
  role: 'editor' | 'viewer',
  accessToken: string
): Promise<ApiResponse<SharedEventMember>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-events/${eventId}/members/${memberId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ role })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to update member role' }
    }

    return await response.json()
  } catch (error) {
    console.error('Error updating event member role:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function removeEventMember(
  eventId: string,
  memberId: string,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-events/${eventId}/members/${memberId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to remove member' }
    }

    return await response.json()
  } catch (error) {
    console.error('Error removing event member:', error)
    return { success: false, error: 'Network error' }
  }
}
