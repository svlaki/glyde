import { User } from '@supabase/supabase-js'

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export interface PreferencesData {
  work_hours: {
    start: string
    end: string
    flexible: boolean
  }
  communication: {
    style: 'direct' | 'collaborative' | 'formal' | 'casual'
    preferred_channels: string[]
  }
  productivity: {
    focus_block_duration: number
    break_frequency: number
    meeting_preference: 'morning' | 'afternoon' | 'flexible'
    deep_work_time: 'morning' | 'afternoon' | 'evening'
  }
}

export interface OnboardingData {
  name: string
  occupation: string
  goals: string[]
  aspects: string[]
  timezone: string
  preferences: PreferencesData
}

export async function completeOnboarding(
  user: User,
  accessToken: string,
  data: OnboardingData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/onboarding/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        ...data
      })
    })

    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to complete onboarding' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return { success: false, error: 'Failed to complete onboarding' }
  }
}

export async function saveOnboardingStep(
  user: User,
  accessToken: string,
  step: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/onboarding/save-step`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        step,
        data
      })
    })

    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to save step' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving onboarding step:', error)
    return { success: false, error: 'Failed to save step' }
  }
}
