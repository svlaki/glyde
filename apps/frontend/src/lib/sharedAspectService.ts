export interface SharedAspect {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface SharedAspectMember {
  id: string
  aspect_id: string
  user_id: string
  role: 'owner' | 'member' | 'viewer'
  status: 'pending' | 'accepted' | 'declined'
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

export async function createSharedAspect(
  name: string,
  accessToken: string,
  description?: string,
  color?: string,
  icon?: string
): Promise<ApiResponse<SharedAspect>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ name, description, color, icon })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to create shared aspect' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating shared aspect:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function getUserSharedAspects(
  accessToken: string
): Promise<ApiResponse<SharedAspect[]>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to fetch aspects' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching shared aspects:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function getAspectMembers(
  aspectId: string,
  accessToken: string
): Promise<ApiResponse<SharedAspectMember[]>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects/${aspectId}/members`, {
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

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching aspect members:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function addMember(
  aspectId: string,
  userId: string,
  role: 'member' | 'viewer',
  accessToken: string
): Promise<ApiResponse<SharedAspectMember>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects/${aspectId}/members`, {
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

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding member:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function updateMemberRole(
  aspectId: string,
  memberId: string,
  role: 'member' | 'viewer',
  accessToken: string
): Promise<ApiResponse<SharedAspectMember>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects/${aspectId}/members/${memberId}`, {
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

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating member role:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function removeMember(
  aspectId: string,
  memberId: string,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects/${aspectId}/members/${memberId}`, {
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

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error removing member:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function updateSharedAspect(
  aspectId: string,
  updates: { name?: string; description?: string; color?: string; icon?: string },
  accessToken: string
): Promise<ApiResponse<SharedAspect>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects/${aspectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to update aspect' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating aspect:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function deleteSharedAspect(
  aspectId: string,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/shared-aspects/${aspectId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to delete aspect' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting aspect:', error)
    return { success: false, error: 'Network error' }
  }
}
