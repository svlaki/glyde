import type { User } from '@supabase/supabase-js'

export interface Reminder {
  id: string
  user_id: string
  message: string
  trigger_at: string
  status: 'pending' | 'delivered' | 'snoozed' | 'dismissed'
  aspect_id?: string
  created_by: 'conversation' | 'interaction' | 'user'
  metadata: Record<string, any>
  delivered_at?: string
  interaction_id?: string
  created_at: string
  updated_at: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchReminders(
  user: User,
  accessToken: string,
  filters?: { status?: string; includeHistory?: boolean }
): Promise<{ reminders: Reminder[]; error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { reminders: [], error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        status: filters?.status,
        include_history: filters?.includeHistory,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { reminders: [], error: data.error || 'Failed to fetch reminders' }
    }

    return { reminders: data.reminders || [], error: null }
  } catch {
    return { reminders: [], error: 'Failed to fetch reminders' }
  }
}

export async function deleteReminder(
  user: User,
  accessToken: string,
  reminderId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/reminders/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ user_id: user.id, reminder_id: reminderId }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete reminder' }
    }

    return { success: true, error: null }
  } catch {
    return { success: false, error: 'Failed to delete reminder' }
  }
}

export async function snoozeReminder(
  user: User,
  accessToken: string,
  reminderId: string,
  snoozeMinutes: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/reminders/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        reminder_id: reminderId,
        snooze_minutes: snoozeMinutes,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to snooze reminder' }
    }

    return { success: true, error: null }
  } catch {
    return { success: false, error: 'Failed to snooze reminder' }
  }
}

export async function dismissEventReminders(
  user: User,
  accessToken: string,
  eventId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/reminders/dismiss-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ user_id: user.id, event_id: eventId }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to dismiss event reminders' }
    }

    return { success: true, error: null }
  } catch {
    return { success: false, error: 'Failed to dismiss event reminders' }
  }
}
