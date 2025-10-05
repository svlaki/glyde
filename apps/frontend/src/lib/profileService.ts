import { User } from '@supabase/supabase-js'
import { post } from './apiClient'

export interface UserProfile {
  user_id: string
  life?: Record<string, any>
  work?: Record<string, any>
  productivity?: Record<string, any>
  health?: Record<string, any>
  relationships?: Record<string, any>
  routines?: Record<string, any>
  decision_making?: Record<string, any>
  communication?: Record<string, any>
  learning?: Record<string, any>
  agent_preferences?: Record<string, any>
  rules?: Record<string, any>
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

export async function fetchUserProfile(
  user: User,
  section?: string
): Promise<{ profile?: UserProfile, section?: string, data?: any, completeness?: any, summary?: ProfileSummary, error: string | null }> {
  try {
    if (!user) {
      return { error: 'User not authenticated' }
    }

    const response = await post<{
      section?: string
      data?: any
      profile?: UserProfile
      completeness?: any
      summary?: ProfileSummary
      error?: string
    }>(
      '/api/profile',
      {
        user_id: user.id,
        section
      }
    )

    if (!response.ok) {
      return { error: response.error || 'Failed to fetch profile' }
    }

    if (section) {
      return {
        section: response.data?.section,
        data: response.data?.data,
        error: null
      }
    }

    return {
      profile: response.data?.profile,
      completeness: response.data?.completeness,
      summary: response.data?.summary,
      error: null
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
    return { error: 'Failed to fetch profile' }
  }
}

export async function updateUserProfile(
  user: User,
  section?: string,
  data?: Record<string, any>
): Promise<{ success: boolean, message?: string, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!section && !data) {
      return { success: false, error: 'Either section with data or complete profile data is required' }
    }

    const response = await post<{ success: boolean; message?: string; error?: string }>(
      '/api/profile/update',
      {
        user_id: user.id,
        section,
        data
      }
    )

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to update profile' }
    }

    return {
      success: Boolean(response.data?.success),
      message: response.data?.message,
      error: null
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { success: false, error: 'Failed to update profile' }
  }
}

export async function updateProfileField(
  user: User,
  field: string,
  value: any
): Promise<{ success: boolean, message?: string, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!field) {
      return { success: false, error: 'Field is required' }
    }

    const response = await post<{ success: boolean; message?: string; error?: string }>(
      '/api/profile/field',
      {
        user_id: user.id,
        field,
        value
      }
    )

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to update profile field' }
    }

    return {
      success: Boolean(response.data?.success),
      message: response.data?.message,
      error: null
    }
  } catch (error) {
    console.error('Error updating profile field:', error)
    return { success: false, error: 'Failed to update profile field' }
  }
}

export async function batchUpdateProfileFields(
  user: User,
  updates: Array<{ field: string, value: any }>
): Promise<{ success: boolean, message?: string, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!updates || !Array.isArray(updates)) {
      return { success: false, error: 'Updates array is required' }
    }

    const response = await post<{ success: boolean; message?: string; error?: string }>(
      '/api/profile/batch-update',
      {
        user_id: user.id,
        updates
      }
    )

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to batch update profile fields' }
    }

    return {
      success: Boolean(response.data?.success),
      message: response.data?.message,
      error: null
    }
  } catch (error) {
    console.error('Error batch updating profile fields:', error)
    return { success: false, error: 'Failed to batch update profile fields' }
  }
}
