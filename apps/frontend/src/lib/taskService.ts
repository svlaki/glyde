import { User } from '@supabase/supabase-js'

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  aspect?: string // DEPRECATED: use aspect_name
  aspect_id?: string
  aspect_name?: string // From aspects table join
  aspect_color?: string // From aspects table join
  due_date?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  completed_at?: string
  parent_goal_id?: string
  created_at?: string
  updated_at?: string
  energy_required?: 'low' | 'medium' | 'high'
  estimated_duration?: number
  actual_duration?: number
  context_required?: Record<string, any>
  completion_notes?: string
  recurring_pattern?: Record<string, any>
  is_shared?: boolean
  project_id?: string
  project_name?: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchUserTasks(
  user: User,
  accessToken: string,
  filters?: {
    status?: string
    aspect?: string
    priority?: string
    due_before?: string
    due_after?: string
    completed_after?: string
  }
): Promise<{ tasks: Task[], error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { tasks: [], error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        user_id: user.id,
        ...filters
      }),
      cache: 'no-store'
    })

    const data = await response.json()

    if (!response.ok) {
      return { tasks: [], error: data.error || 'Failed to fetch tasks' }
    }

    return { tasks: data.tasks || [], error: null }
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return { tasks: [], error: 'Failed to fetch tasks' }
  }
}

export async function createUserTask(
  user: User,
  accessToken: string,
  taskData: {
    title: string
    description?: string
    aspect?: string
    due_date?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    parent_goal_id?: string
    energy_required?: 'low' | 'medium' | 'high'
    estimated_duration?: number
    context_required?: Record<string, any>
    recurring_pattern?: Record<string, any>
  }
): Promise<{ task: Task | null, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { task: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/tasks/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        ...taskData
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { task: null, error: data.error || 'Failed to create task' }
    }

    return { task: data.task, error: null }
  } catch (error) {
    console.error('Error creating task:', error)
    return { task: null, error: 'Failed to create task' }
  }
}

export async function updateUserTask(
  user: User,
  accessToken: string,
  taskId: string,
  updates: Partial<Task>
): Promise<{ task: Task | null, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { task: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/tasks/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        task_id: taskId,
        ...updates
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { task: null, error: data.error || 'Failed to update task' }
    }

    return { task: data.task, error: null }
  } catch (error) {
    console.error('Error updating task:', error)
    return { task: null, error: 'Failed to update task' }
  }
}

export async function deleteUserTask(
  user: User,
  accessToken: string,
  taskId: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/tasks/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        task_id: taskId
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete task' }
    }

    return { success: data.success, error: data.error }
  } catch (error) {
    console.error('Error deleting task:', error)
    return { success: false, error: 'Failed to delete task' }
  }
}

export async function completeUserTask(
  user: User,
  accessToken: string,
  taskId: string,
  notes?: string,
  actualDuration?: number
): Promise<{ task: Task | null, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { task: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/tasks/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        task_id: taskId,
        notes,
        actual_duration: actualDuration
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { task: null, error: data.error || 'Failed to complete task' }
    }

    return { task: data.task, error: null }
  } catch (error) {
    console.error('Error completing task:', error)
    return { task: null, error: 'Failed to complete task' }
  }
}
