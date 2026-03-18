export interface FriendAspect {
  id: string
  name: string
  color: string
  icon?: string
}

export interface Friend {
  friendship_id: string
  friend_id: string
  friend_email: string
  friend_display_name: string
  friend_avatar_url?: string
  friendship_status: string
  notes?: string
  aspects: FriendAspect[]
  created_at: string
}

export interface FriendRequest {
  id: string
  requester_id: string
  requester_email: string
  requester_display_name: string
  requester_avatar_url?: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
}

export interface DiscoverUser {
  id: string
  email: string
  display_name: string
  avatar_url?: string
  relationship: 'none' | 'pending_sent' | 'pending_received' | 'friends'
  friendship_id?: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

import { trackEvent } from './analytics'

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function sendFriendRequest(
  email: string,
  accessToken: string
): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ addresseeEmail: email })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to send friend request' }
    }

    const data = await response.json()
    if (data.success) trackEvent('friend_request_sent', 'engagement')
    return data
  } catch (error) {
    console.error('Error sending friend request:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function acceptFriendRequest(
  friendshipId: string,
  accessToken: string
): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/${friendshipId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to accept request' }
    }

    const data = await response.json()
    if (data.success) trackEvent('friend_request_accepted', 'engagement')
    return data
  } catch (error) {
    console.error('Error accepting friend request:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function declineFriendRequest(
  friendshipId: string,
  block: boolean = false,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/${friendshipId}/decline?block=${block}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to decline request' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error declining friend request:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function getFriends(accessToken: string): Promise<ApiResponse<Friend[]>> {
  try {
    const response = await fetch(`${API_URL}/api/friends`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to fetch friends' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching friends:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function getPendingRequests(accessToken: string): Promise<ApiResponse<FriendRequest[]>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to fetch requests' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching pending requests:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function removeFriend(
  friendshipId: string,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/${friendshipId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to remove friend' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error removing friend:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function updateFriendNotes(
  friendshipId: string,
  notes: string,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/${friendshipId}/notes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ notes })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to update notes' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating friend notes:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function addFriendAspect(
  friendshipId: string,
  aspectId: string,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/${friendshipId}/aspects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ aspectId })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to add aspect' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding friend aspect:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function removeFriendAspect(
  friendshipId: string,
  aspectId: string,
  accessToken: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_URL}/api/friends/${friendshipId}/aspects/${aspectId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to remove aspect' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error removing friend aspect:', error)
    return { success: false, error: 'Network error' }
  }
}

export async function searchUsers(
  query: string,
  accessToken: string
): Promise<ApiResponse<DiscoverUser[]>> {
  try {
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
    const response = await fetch(`${API_URL}/api/friends/search${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Failed to search users' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error searching users:', error)
    return { success: false, error: 'Network error' }
  }
}
