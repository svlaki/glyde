import { User } from '@supabase/supabase-js'
import { post } from './apiClient'

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  category?: string
  due_date?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  completed_at?: string
  parent_goal_id?: string
  color?: string
  created_at?: string
  updated_at?: string
  energy_required?: 'low' | 'medium' | 'high'
  estimated_duration?: number
  actual_duration?: number
  context_required?: Record<string, any>
  completion_notes?: string
  recurring_pattern?: Record<string, any>
  task_metadata?: Record<string, any>
}

export async function fetchUserTasks(
  user: User,
  filters?: {
    status?: string
    category?: string
    priority?: string
    due_before?: string
    due_after?: string
  }
): Promise<{ tasks: Task[], error: string | null }> {
  try {
    if (!user) {
      return { tasks: [], error: 'User not authenticated' }
    }

    const response = await post<{ tasks?: Task[]; error?: string }>(
      '/api/tasks',
      {
        user_id: user.id,
        ...filters
      }
    )

    if (!response.ok) {
      return { tasks: [], error: response.error || 'Failed to fetch tasks' }
    }

    const tasks = Array.isArray(response.data?.tasks) ? response.data!.tasks : []
    return { tasks, error: null }
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return { tasks: [], error: 'Failed to fetch tasks' }
  }
}

export async function createUserTask(
  user: User,
  taskData: {
    title: string
    description?: string
    category?: string
    due_date?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    parent_goal_id?: string
    color?: string
    energy_required?: 'low' | 'medium' | 'high'
    estimated_duration?: number
    context_required?: Record<string, any>
    recurring_pattern?: Record<string, any>
    task_metadata?: Record<string, any>
  }
): Promise<{ task: Task | null, error: string | null }> {
  try {
    if (!user) {
      return { task: null, error: 'User not authenticated' }
    }

    const response = await post<{ task?: Task; error?: string }>(
      '/api/tasks/create',
      {
        user_id: user.id,
        ...taskData
      }
    )

    if (!response.ok) {
      return { task: null, error: response.error || 'Failed to create task' }
    }

    if (!response.data?.task) {
      return { task: null, error: 'Task payload missing from response' }
    }

    return { task: response.data.task, error: null }
  } catch (error) {
    console.error('Error creating task:', error)
    return { task: null, error: 'Failed to create task' }
  }
}

export async function updateUserTask(
  user: User,
  taskId: string,
  updates: Partial<Task>
): Promise<{ task: Task | null, error: string | null }> {
  try {
    if (!user) {
      return { task: null, error: 'User not authenticated' }
    }

    const response = await post<{ task?: Task; error?: string }>(
      '/api/tasks/update',
      {
        user_id: user.id,
        task_id: taskId,
        ...updates
      }
    )

    if (!response.ok) {
      return { task: null, error: response.error || 'Failed to update task' }
    }

    if (!response.data?.task) {
      return { task: null, error: 'Task payload missing from response' }
    }

    return { task: response.data.task, error: null }
  } catch (error) {
    console.error('Error updating task:', error)
    return { task: null, error: 'Failed to update task' }
  }
}

export async function deleteUserTask(
  user: User,
  taskId: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await post<{ success: boolean; error?: string }>(
      '/api/tasks/delete',
      {
        user_id: user.id,
        task_id: taskId
      }
    )

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to delete task' }
    }

    return { success: Boolean(response.data?.success), error: response.data?.error ?? null }
  } catch (error) {
    console.error('Error deleting task:', error)
    return { success: false, error: 'Failed to delete task' }
  }
}

export async function completeUserTask(
  user: User,
  taskId: string,
  notes?: string,
  actualDuration?: number
): Promise<{ task: Task | null, error: string | null }> {
  try {
    if (!user) {
      return { task: null, error: 'User not authenticated' }
    }

    const response = await post<{ task?: Task; error?: string }>(
      '/api/tasks/complete',
      {
        user_id: user.id,
        task_id: taskId,
        notes,
        actual_duration: actualDuration
      }
    )

    if (!response.ok) {
      return { task: null, error: response.error || 'Failed to complete task' }
    }

    if (!response.data?.task) {
      return { task: null, error: 'Task payload missing from response' }
    }

    return { task: response.data.task, error: null }
  } catch (error) {
    console.error('Error completing task:', error)
    return { task: null, error: 'Failed to complete task' }
  }
}
