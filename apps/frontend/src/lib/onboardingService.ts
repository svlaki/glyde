import { User } from '@supabase/supabase-js'

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

// Gender options for Section 1
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' }
]

// Calendar options for Section 2
// Only Google has OAuth import - others can use ICS file upload
export const CALENDAR_OPTIONS = [
  { id: 'google', label: 'Google Calendar', importable: true },
  { id: 'apple', label: 'Apple/iCloud', importable: false },
  { id: 'outlook', label: 'Outlook', importable: false },
  { id: 'notion', label: 'Notion', importable: false },
  { id: 'none', label: 'None', importable: false },
  { id: 'other', label: 'Other', importable: false }
]

// Default life aspects for Section 3
export const DEFAULT_ASPECTS = ['Work/School', 'Health', 'Personal']

// Habit/personality options for Section 3
export const HABIT_OPTIONS = [
  { id: 'deadlines', label: 'I struggle to stay on top of deadlines' },
  { id: 'task-switching', label: 'I find it difficult to switch tasks quickly' },
  { id: 'procrastinator', label: 'I am a huge procrastinator' },
  { id: 'easily-distracted', label: 'I get easily distracted' },
  { id: 'poor-time-estimation', label: 'I often underestimate how long tasks take' },
  { id: 'overcommit', label: 'I tend to overcommit myself' },
  { id: 'forget-tasks', label: 'I frequently forget tasks or appointments' },
  { id: 'work-life-balance', label: 'I struggle with work-life balance' },
  { id: 'perfectionist', label: 'I spend too much time perfecting things' },
  { id: 'energy-management', label: 'I have trouble managing my energy throughout the day' }
]

// V2 Onboarding data interface
export interface OnboardingDataV2 {
  fullName: string
  preferredName: string
  birthday: string
  gender: string
  selectedCalendars: string[]
  otherCalendar?: string
  occupation: string
  fieldOfStudy?: string
  aspects: string[]
  goals: string[]
  habits: string[]
  timezone: string
}

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

    console.log('🔵 Completing onboarding...')
    console.log('🔵 API_URL:', API_URL)
    console.log('🔵 Full URL:', `${API_URL}/api/onboarding/complete`)
    console.log('🔵 User ID:', user.id)

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

    console.log('🔵 Response status:', response.status)
    console.log('🔵 Response ok:', response.ok)

    const result = await response.json()
    console.log('🔵 Response body:', result)

    if (!response.ok) {
      console.error('🔴 Onboarding failed:', result.error)
      return { success: false, error: result.error || 'Failed to complete onboarding' }
    }

    console.log('✅ Onboarding completed successfully')
    return { success: true }
  } catch (error) {
    console.error('🔴 Error completing onboarding:', error)
    console.error('🔴 Error type:', typeof error)

    if (error instanceof Error) {
      console.error('🔴 Error message:', error.message)
      console.error('🔴 Error stack:', error.stack)
      return { success: false, error: `Network error: ${error.message}` }
    }

    if (error instanceof TypeError) {
      console.error('🔴 TypeError - likely CORS or connection refused')
      return { success: false, error: 'Cannot connect to backend. Make sure Docker is running.' }
    }

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

export async function completeOnboardingV2(
  user: User,
  accessToken: string,
  data: OnboardingDataV2
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
