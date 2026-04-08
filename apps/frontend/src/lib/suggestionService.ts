import type { User } from '@supabase/supabase-js'

export interface ActionSuggestion {
  id: string
  user_id: string
  title: string
  description?: string
  suggestion_type: 'goal_step' | 'task_step' | 'prep_step' | 'habit' | 'general'
  source_entity_type?: 'goal' | 'task' | 'event' | 'aspect'
  source_entity_id?: string
  aspect_id?: string
  estimated_minutes?: number
  energy_level?: 'low' | 'medium' | 'high'
  status: 'open' | 'snoozed' | 'completed' | 'archived'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SlotWithSuggestion {
  id: string
  user_id: string
  start_time: string
  end_time: string
  status: 'proposed' | 'edited' | 'confirmed' | 'dismissed' | 'expired'
  source_agent?: string
  reasoning?: string
  expires_at?: string
  confirmed_event_id?: string
  created_at: string
  updated_at: string
  suggestion_id: string
  suggestion_title: string
  suggestion_description?: string
  suggestion_type: string
  estimated_minutes?: number
  energy_level?: string
  aspect_id?: string
  aspect_name?: string
  aspect_color?: string
  aspect_icon?: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

function buildHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  return headers
}

// --- Suggestions ---

export async function fetchUserSuggestions(
  user: User,
  filters?: { status?: string; aspect_id?: string },
  accessToken?: string
): Promise<{ suggestions: ActionSuggestion[]; error: string | null }> {
  try {
    if (!user) return { suggestions: [], error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/suggestions/list`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, ...filters }),
    })

    const data = await response.json()
    if (!response.ok) return { suggestions: [], error: data.error || 'Failed to fetch suggestions' }

    return { suggestions: data.suggestions || [], error: null }
  } catch {
    return { suggestions: [], error: 'Failed to fetch suggestions' }
  }
}

export async function createUserSuggestion(
  user: User,
  input: {
    title: string
    description?: string
    suggestion_type: string
    source_entity_type?: string
    source_entity_id?: string
    aspect_id?: string
    estimated_minutes?: number
    energy_level?: string
    metadata?: Record<string, unknown>
  },
  accessToken?: string
): Promise<{ suggestion: ActionSuggestion | null; error: string | null }> {
  try {
    if (!user) return { suggestion: null, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/suggestions/create`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, ...input }),
    })

    const data = await response.json()
    if (!response.ok) return { suggestion: null, error: data.error || 'Failed to create suggestion' }

    return { suggestion: data.suggestion, error: null }
  } catch {
    return { suggestion: null, error: 'Failed to create suggestion' }
  }
}

// --- Slots ---

export async function fetchUserSlots(
  user: User,
  startDate: string,
  endDate: string,
  accessToken?: string
): Promise<{ slots: SlotWithSuggestion[]; error: string | null }> {
  try {
    if (!user) return { slots: [], error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/slots/list`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, start_date: startDate, end_date: endDate }),
    })

    const data = await response.json()
    if (!response.ok) return { slots: [], error: data.error || 'Failed to fetch slots' }

    return { slots: data.slots || [], error: null }
  } catch {
    return { slots: [], error: 'Failed to fetch slots' }
  }
}

export async function moveSlot(
  user: User,
  slotId: string,
  startTime: string,
  endTime: string,
  accessToken?: string
): Promise<{ slot: SlotWithSuggestion | null; error: string | null }> {
  try {
    if (!user) return { slot: null, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/slots/move`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, slot_id: slotId, start_time: startTime, end_time: endTime }),
    })

    const data = await response.json()
    if (!response.ok) return { slot: null, error: data.error || 'Failed to move slot' }

    return { slot: data.slot, error: null }
  } catch {
    return { slot: null, error: 'Failed to move slot' }
  }
}

export async function resizeSlot(
  user: User,
  slotId: string,
  endTime: string,
  accessToken?: string
): Promise<{ slot: SlotWithSuggestion | null; error: string | null }> {
  try {
    if (!user) return { slot: null, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/slots/resize`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, slot_id: slotId, end_time: endTime }),
    })

    const data = await response.json()
    if (!response.ok) return { slot: null, error: data.error || 'Failed to resize slot' }

    return { slot: data.slot, error: null }
  } catch {
    return { slot: null, error: 'Failed to resize slot' }
  }
}

export async function swapSlot(
  user: User,
  slotId: string,
  accessToken?: string,
  suggestionId?: string
): Promise<{ slot: SlotWithSuggestion | null; error: string | null }> {
  try {
    if (!user) return { slot: null, error: 'User not authenticated' }

    const body: Record<string, string> = { user_id: user.id, slot_id: slotId }
    if (suggestionId) body.suggestion_id = suggestionId

    const response = await fetch(`${API_URL}/api/slots/swap`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (!response.ok) return { slot: null, error: data.error || 'Failed to swap slot' }

    return { slot: data.slot, error: null }
  } catch {
    return { slot: null, error: 'Failed to swap slot' }
  }
}

export async function confirmSlot(
  user: User,
  slotId: string,
  accessToken?: string
): Promise<{ event_id: string | null; error: string | null }> {
  try {
    if (!user) return { event_id: null, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/slots/confirm`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, slot_id: slotId }),
    })

    const data = await response.json()
    if (!response.ok) return { event_id: null, error: data.error || 'Failed to confirm slot' }

    return { event_id: data.event_id, error: null }
  } catch {
    return { event_id: null, error: 'Failed to confirm slot' }
  }
}

export async function replenishSlots(
  user: User,
  accessToken?: string
): Promise<{ error: string | null }> {
  try {
    if (!user) return { error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/slots/replenish`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id }),
    })

    const data = await response.json()
    if (!response.ok) return { error: data.error || 'Failed to replenish slots' }

    return { error: null }
  } catch {
    return { error: 'Failed to replenish slots' }
  }
}

export async function generateSuggestionsBatch(
  user: User,
  accessToken?: string
): Promise<{ error: string | null }> {
  try {
    if (!user) return { error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/suggestions/generate-batch`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id }),
    })

    const data = await response.json()
    if (!response.ok) return { error: data.error || 'Failed to generate suggestions' }

    return { error: null }
  } catch {
    return { error: 'Failed to generate suggestions' }
  }
}

export async function dismissSlot(
  user: User,
  slotId: string,
  reason?: string,
  accessToken?: string
): Promise<{ error: string | null }> {
  try {
    if (!user) return { error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/slots/dismiss`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, slot_id: slotId, reason }),
    })

    const data = await response.json()
    if (!response.ok) return { error: data.error || 'Failed to dismiss slot' }

    return { error: null }
  } catch {
    return { error: 'Failed to dismiss slot' }
  }
}
