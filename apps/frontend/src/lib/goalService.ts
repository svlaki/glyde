import { User } from '@supabase/supabase-js'
import { apiCall, validateRequired, formatErrorMessage } from './apiUtils'

export interface Goal {
  id: string
  user_id: string
  title: string
  description?: string
  aspect?: string
  target_date?: string
  status?: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'abandoned'
  progress?: number
  milestone_type?: 'dated' | 'ordered'
  milestones?: Array<{
    title: string
    completed: boolean
    due_date?: string
  }>
  goal_type?: 'smart' | 'okr' | 'milestone' | 'habit' | 'project'
  time_horizon?: 'long_term' | 'short_term'
  parent_goal_id?: string
  key_results?: Array<{
    description: string
    target_value: number
    current_value: number
    unit: string
  }>
  blockers?: string[]
  resources_needed?: string[]
  reflection_prompts?: string[]
  priority_score?: number
  energy_requirement?: 'low' | 'medium' | 'high'
  review_frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  created_at?: string
  updated_at?: string
}

export interface GoalCheckIn {
  id: string
  goal_id: string
  user_id: string
  progress_update?: number
  mood_rating?: number
  confidence_level?: number
  obstacles_encountered?: string[]
  wins_and_progress?: string[]
  next_steps?: string[]
  reflection_notes?: string
  agent_insights?: Record<string, any>
  created_at?: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchUserGoals(
  user: User,
  accessToken: string,
  filters?: {
    status?: string
    aspect?: string
    goal_type?: string
    target_before?: string
    target_after?: string
  }
): Promise<{ goals: Goal[], error: string | null }> {
  if (!user || !accessToken) {
    return { goals: [], error: 'User not authenticated' }
  }

  // Validate API URL
  if (!API_URL) {
    console.error('API_URL is not configured')
    return { goals: [], error: 'Service configuration error' }
  }

  const result = await apiCall<{ goals: Goal[] }>(`${API_URL}/api/goals`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      user_id: user.id,
      ...filters
    }),
  })

  if (!result.success) {
    return { goals: [], error: formatErrorMessage(result.error) }
  }

  // Validate response structure
  if (!result.data || !Array.isArray(result.data.goals)) {
    console.error('Invalid goals data format:', result.data)
    return { goals: [], error: 'Invalid goals data format' }
  }

  return { goals: result.data.goals, error: null }
}

export async function createUserGoal(
  user: User,
  accessToken: string,
  goalData: {
    title: string
    description?: string
    aspect?: string
    target_date?: string
    status?: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'abandoned'
    progress?: number
    milestone_type?: 'dated' | 'ordered'
    milestones?: Array<{
      title: string
      completed: boolean
      due_date?: string
    }>
    goal_type?: 'smart' | 'okr' | 'milestone' | 'habit' | 'project'
    time_horizon?: 'long_term' | 'short_term'
    parent_goal_id?: string
    key_results?: Array<{
      description: string
      target_value: number
      current_value: number
      unit: string
    }>
    blockers?: string[]
    resources_needed?: string[]
    reflection_prompts?: string[]
    priority_score?: number
    energy_requirement?: 'low' | 'medium' | 'high'
    review_frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  }
): Promise<{ goal: Goal | null, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { goal: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/goals/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        ...goalData
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { goal: null, error: data.error || 'Failed to create goal' }
    }

    return { goal: data.goal, error: null }
  } catch (error) {
    console.error('Error creating goal:', error)
    return { goal: null, error: 'Failed to create goal' }
  }
}

export async function updateUserGoal(
  user: User,
  accessToken: string,
  goalId: string,
  updates: Partial<Goal>
): Promise<{ goal: Goal | null, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { goal: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/goals/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        goal_id: goalId,
        ...updates
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { goal: null, error: data.error || 'Failed to update goal' }
    }

    return { goal: data.goal, error: null }
  } catch (error) {
    console.error('Error updating goal:', error)
    return { goal: null, error: 'Failed to update goal' }
  }
}

export async function deleteUserGoal(
  user: User,
  accessToken: string,
  goalId: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/goals/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        goal_id: goalId
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete goal' }
    }

    return { success: data.success, error: data.error }
  } catch (error) {
    console.error('Error deleting goal:', error)
    return { success: false, error: 'Failed to delete goal' }
  }
}

export async function addGoalCheckIn(
  user: User,
  accessToken: string,
  goalId: string,
  checkInData: {
    progress_update?: number
    mood_rating?: number
    confidence_level?: number
    obstacles_encountered?: string[]
    wins_and_progress?: string[]
    next_steps?: string[]
    reflection_notes?: string
    agent_insights?: Record<string, any>
  }
): Promise<{ checkIn: GoalCheckIn | null, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { checkIn: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/goals/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        goal_id: goalId,
        ...checkInData
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { checkIn: null, error: data.error || 'Failed to add check-in' }
    }

    return { checkIn: data.checkIn, error: null }
  } catch (error) {
    console.error('Error adding goal check-in:', error)
    return { checkIn: null, error: 'Failed to add check-in' }
  }
}

