import { User } from '@supabase/supabase-js'
import { formatErrorMessage } from './apiUtils'
import { post } from './apiClient'

export interface Goal {
  id: string
  user_id: string
  title: string
  description?: string
  category?: string
  target_date?: string
  status?: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'abandoned'
  progress?: number
  milestones?: Array<{
    title: string
    completed: boolean
    due_date?: string
  }>
  goal_type?: 'smart' | 'okr' | 'milestone' | 'habit' | 'project'
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

export async function fetchUserGoals(
  user: User,
  filters?: {
    status?: string
    category?: string
    goal_type?: string
    target_before?: string
    target_after?: string
  }
): Promise<{ goals: Goal[], error: string | null }> {
  if (!user) {
    return { goals: [], error: 'User not authenticated' }
  }

  const response = await post<{ goals?: Goal[]; error?: string }>(
    '/api/goals',
    {
      user_id: user.id,
      ...filters
    }
  )

  if (!response.ok) {
    return { goals: [], error: formatErrorMessage(response.error) }
  }

  if (!response.data || !Array.isArray(response.data.goals)) {
    console.error('Invalid goals data format:', response.data)
    return { goals: [], error: 'Invalid goals data format' }
  }

  return { goals: response.data.goals, error: null }
}

export async function createUserGoal(
  user: User,
  goalData: {
    title: string
    description?: string
    category?: string
    target_date?: string
    status?: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'abandoned'
    progress?: number
    milestones?: Array<{
      title: string
      completed: boolean
      due_date?: string
    }>
    goal_type?: 'smart' | 'okr' | 'milestone' | 'habit' | 'project'
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
    if (!user) {
      return { goal: null, error: 'User not authenticated' }
    }

    const response = await post<{ goal?: Goal; error?: string }>(
      '/api/goals/create',
      {
        user_id: user.id,
        ...goalData
      }
    )

    if (!response.ok) {
      return { goal: null, error: response.error || 'Failed to create goal' }
    }

    if (!response.data?.goal) {
      return { goal: null, error: 'Goal payload missing from response' }
    }

    return { goal: response.data.goal, error: null }
  } catch (error) {
    console.error('Error creating goal:', error)
    return { goal: null, error: 'Failed to create goal' }
  }
}

export async function updateUserGoal(
  user: User,
  goalId: string,
  updates: Partial<Goal>
): Promise<{ goal: Goal | null, error: string | null }> {
  try {
    if (!user) {
      return { goal: null, error: 'User not authenticated' }
    }

    const response = await post<{ goal?: Goal; error?: string }>(
      '/api/goals/update',
      {
        user_id: user.id,
        goal_id: goalId,
        ...updates
      }
    )

    if (!response.ok) {
      return { goal: null, error: response.error || 'Failed to update goal' }
    }

    if (!response.data?.goal) {
      return { goal: null, error: 'Goal payload missing from response' }
    }

    return { goal: response.data.goal, error: null }
  } catch (error) {
    console.error('Error updating goal:', error)
    return { goal: null, error: 'Failed to update goal' }
  }
}

export async function deleteUserGoal(
  user: User,
  goalId: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await post<{ success: boolean; error?: string }>(
      '/api/goals/delete',
      {
        user_id: user.id,
        goal_id: goalId
      }
    )

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to delete goal' }
    }

    return { success: Boolean(response.data?.success), error: response.data?.error ?? null }
  } catch (error) {
    console.error('Error deleting goal:', error)
    return { success: false, error: 'Failed to delete goal' }
  }
}

export async function addGoalCheckIn(
  user: User,
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
    if (!user) {
      return { checkIn: null, error: 'User not authenticated' }
    }

    const response = await post<{ checkIn?: GoalCheckIn; error?: string }>(
      '/api/goals/check-in',
      {
        user_id: user.id,
        goal_id: goalId,
        ...checkInData
      }
    )

    if (!response.ok) {
      return { checkIn: null, error: response.error || 'Failed to add check-in' }
    }

    if (!response.data?.checkIn) {
      return { checkIn: null, error: 'Check-in payload missing from response' }
    }

    return { checkIn: response.data.checkIn, error: null }
  } catch (error) {
    console.error('Error adding goal check-in:', error)
    return { checkIn: null, error: 'Failed to add check-in' }
  }
}

export async function fetchGoalCheckIns(
  user: User,
  goalId: string,
  limit?: number
): Promise<{ checkIns: GoalCheckIn[], error: string | null }> {
  try {
    if (!user) {
      return { checkIns: [], error: 'User not authenticated' }
    }

    const response = await post<{ checkIns?: GoalCheckIn[]; error?: string }>(
      '/api/goals/check-ins',
      {
        user_id: user.id,
        goal_id: goalId,
        limit
      }
    )

    if (!response.ok) {
      return { checkIns: [], error: response.error || 'Failed to fetch check-ins' }
    }

    const checkIns = Array.isArray(response.data?.checkIns) ? response.data!.checkIns : []
    return { checkIns, error: null }
  } catch (error) {
    console.error('Error fetching goal check-ins:', error)
    return { checkIns: [], error: 'Failed to fetch check-ins' }
  }
}
