import { User } from '@supabase/supabase-js'

export interface LifePlan {
  id: string
  user_id: string
  title: string
  content?: string
  horizon_start?: string
  horizon_end?: string
  status: 'draft' | 'active' | 'archived'
  created_at: string
  updated_at: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchUserPlan(
  user: User,
  accessToken: string
): Promise<{ plan: LifePlan | null; error: string | null }> {
  if (!user || !accessToken) {
    return { plan: null, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id })
    })

    const data = await response.json()

    if (!response.ok) {
      return { plan: null, error: data.error || 'Failed to fetch plan' }
    }

    return { plan: data.plan, error: null }
  } catch (error) {
    console.error('Error fetching plan:', error)
    return { plan: null, error: 'Failed to fetch plan' }
  }
}

export async function createUserPlan(
  user: User,
  accessToken: string,
  planData: {
    title?: string
    content?: string
    horizon_start?: string
    horizon_end?: string
    status?: 'draft' | 'active' | 'archived'
  }
): Promise<{ plan: LifePlan | null; error: string | null }> {
  if (!user || !accessToken) {
    return { plan: null, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/plan/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        ...planData
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { plan: null, error: data.error || 'Failed to create plan' }
    }

    return { plan: data.plan, error: null }
  } catch (error) {
    console.error('Error creating plan:', error)
    return { plan: null, error: 'Failed to create plan' }
  }
}

export async function updateUserPlan(
  user: User,
  accessToken: string,
  planId: string,
  updates: {
    title?: string
    content?: string
    horizon_start?: string
    horizon_end?: string
    status?: 'draft' | 'active' | 'archived'
  }
): Promise<{ plan: LifePlan | null; error: string | null }> {
  if (!user || !accessToken) {
    return { plan: null, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/plan/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        plan_id: planId,
        ...updates
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { plan: null, error: data.error || 'Failed to update plan' }
    }

    return { plan: data.plan, error: null }
  } catch (error) {
    console.error('Error updating plan:', error)
    return { plan: null, error: 'Failed to update plan' }
  }
}

export async function deleteUserPlan(
  user: User,
  accessToken: string,
  planId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!user || !accessToken) {
    return { success: false, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/plan/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        plan_id: planId
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete plan' }
    }

    return { success: data.success, error: data.error }
  } catch (error) {
    console.error('Error deleting plan:', error)
    return { success: false, error: 'Failed to delete plan' }
  }
}
