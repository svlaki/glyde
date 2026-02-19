import type { User } from '@supabase/supabase-js'

export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  deadline?: string
  details?: Record<string, any>
  aspect_id?: string
  aspect_name?: string
  aspect_color?: string
  aspect_icon?: string
  archived_at?: string
  created_at: string
  updated_at: string
}

export interface ProjectDetail {
  project: Project
  tasks: any[]
  events: any[]
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

function buildHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  return headers
}

export async function fetchUserProjects(
  user: User,
  accessToken?: string
): Promise<{ projects: Project[], error: string | null }> {
  try {
    if (!user) return { projects: [], error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id }),
    })

    const data = await response.json()
    if (!response.ok) return { projects: [], error: data.error || 'Failed to fetch projects' }

    return { projects: data.projects || [], error: null }
  } catch (error) {
    return { projects: [], error: 'Failed to fetch projects' }
  }
}

export async function createUserProject(
  user: User,
  projectData: {
    name: string
    aspect_id: string
    description?: string
    deadline?: string
    details?: Record<string, any>
  },
  accessToken?: string
): Promise<{ project: Project | null, error: string | null }> {
  try {
    if (!user) return { project: null, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/projects/create`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, ...projectData }),
    })

    const data = await response.json()
    if (!response.ok) return { project: null, error: data.error || 'Failed to create project' }

    return { project: data.project, error: null }
  } catch (error) {
    return { project: null, error: 'Failed to create project' }
  }
}

export async function updateUserProject(
  user: User,
  projectId: string,
  updates: Partial<Project>,
  accessToken?: string
): Promise<{ project: Project | null, error: string | null }> {
  try {
    if (!user) return { project: null, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/projects/update`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, project_id: projectId, ...updates }),
    })

    const data = await response.json()
    if (!response.ok) return { project: null, error: data.error || 'Failed to update project' }

    return { project: data.project, error: null }
  } catch (error) {
    return { project: null, error: 'Failed to update project' }
  }
}

export async function archiveUserProject(
  user: User,
  projectId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) return { success: false, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/projects/archive`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, project_id: projectId }),
    })

    const data = await response.json()
    if (!response.ok) return { success: false, error: data.error || 'Failed to archive project' }

    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: 'Failed to archive project' }
  }
}

export async function deleteUserProject(
  user: User,
  projectId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) return { success: false, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/projects/delete`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, project_id: projectId }),
    })

    const data = await response.json()
    if (!response.ok) return { success: false, error: data.error || 'Failed to delete project' }

    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: 'Failed to delete project' }
  }
}

export async function fetchProjectDetail(
  user: User,
  projectId: string,
  accessToken?: string
): Promise<{ detail: ProjectDetail | null, error: string | null }> {
  try {
    if (!user) return { detail: null, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/projects/detail`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id, project_id: projectId }),
    })

    const data = await response.json()
    if (!response.ok) return { detail: null, error: data.error || 'Failed to fetch project detail' }

    return {
      detail: {
        project: data.project,
        tasks: data.tasks || [],
        events: data.events || [],
      },
      error: null,
    }
  } catch (error) {
    return { detail: null, error: 'Failed to fetch project detail' }
  }
}

export async function tagEntityToProject(
  user: User,
  entityType: 'task' | 'event',
  entityId: string,
  projectId: string | null,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) return { success: false, error: 'User not authenticated' }

    const response = await fetch(`${API_URL}/api/projects/tag`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId,
      }),
    })

    const data = await response.json()
    if (!response.ok) return { success: false, error: data.error || 'Failed to tag entity' }

    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: 'Failed to tag entity' }
  }
}
