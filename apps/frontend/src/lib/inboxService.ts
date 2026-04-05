const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export interface InboxItem {
  id: string
  type: 'interaction' | 'event_invite' | 'friend_request' | 'aspect_invite'
  title: string
  subtitle?: string
  created_at: string
  // Interaction fields
  interaction_type?: string
  options?: string[]
  priority?: number
  aspect?: { id: string; name: string; color: string } | null
  metadata?: Record<string, any>
  // Event invite fields
  event_id?: string
  event?: { title: string; start_time: string; end_time: string; location?: string }
  inviter_name?: string
  role?: 'member' | 'viewer'
  // Friend request fields
  friendship_id?: string
  requester?: { id: string; name: string; avatar_url?: string }
  // Aspect invite fields
  aspect_id?: string
  owner_name?: string
}

export async function fetchInboxItems(accessToken: string): Promise<InboxItem[]> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/inbox`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch inbox: ${response.status}`)
  }

  const data = await response.json()
  return data.items || []
}

export async function acceptEventInvite(eventId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/shared-events/${eventId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to accept invite: ${response.status}`)
  }
}

export async function declineEventInvite(eventId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/shared-events/${eventId}/decline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to decline invite: ${response.status}`)
  }
}

export async function acceptAspectInvite(aspectId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/shared-aspects/${aspectId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to accept aspect invite: ${response.status}`)
  }
}

export async function declineAspectInvite(aspectId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/shared-aspects/${aspectId}/decline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to decline aspect invite: ${response.status}`)
  }
}
