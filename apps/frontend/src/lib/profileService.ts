import { User } from '@supabase/supabase-js'

export interface UserProfile {
  user_id: string
  values?: Record<string, any>
  preferences?: Record<string, any>
  work_patterns?: Record<string, any>
  personality_traits?: Record<string, any>
  context_data?: Record<string, any>
  goals_summary?: string
  created_at?: string
  updated_at?: string
}

export interface ProfileSummary {
  totalFields: number
  filledFields: number
  completenessPercentage: number
  sections: {
    [key: string]: {
      totalFields: number
      filledFields: number
      completeness: number
    }
  }
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchUserProfile(
  user: User,
  accessToken: string,
  section?: string
): Promise<{ profile?: UserProfile, section?: string, data?: any, completeness?: any, summary?: ProfileSummary, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        section
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || 'Failed to fetch profile' }
    }

    if (section) {
      return {
        section: data.section,
        data: data.data,
        error: null
      }
    } else {
      return {
        profile: data.profile,
        completeness: data.completeness,
        summary: data.summary,
        error: null
      }
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
    return { error: 'Failed to fetch profile' }
  }
}

export async function updateProfileField(
  user: User,
  accessToken: string,
  field: string,
  value: any
): Promise<{ success: boolean, message?: string, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!field) {
      return { success: false, error: 'Field is required' }
    }

    const response = await fetch(`${API_URL}/api/profile/field`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        field,
        value
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to update profile field' }
    }

    return {
      success: data.success,
      message: data.message,
      error: null
    }
  } catch (error) {
    console.error('Error updating profile field:', error)
    return { success: false, error: 'Failed to update profile field' }
  }
}
