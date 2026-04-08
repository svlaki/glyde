import type { User } from '@supabase/supabase-js'

export interface NoteTemplate {
  id: string
  user_id: string | null
  title: string
  content: string
  aspect_id: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchNoteTemplates(
  user: User,
  accessToken: string
): Promise<{ templates: NoteTemplate[]; error: string | null }> {
  if (!user || !accessToken) {
    return { templates: [], error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id })
    })

    const data = await response.json()

    if (!response.ok) {
      return { templates: [], error: data.error || 'Failed to fetch templates' }
    }

    return { templates: data.templates || [], error: null }
  } catch (error) {
    return { templates: [], error: 'Failed to fetch templates' }
  }
}

export async function createNoteTemplate(
  user: User,
  accessToken: string,
  template: { title: string; content: string; aspect_id?: string }
): Promise<{ template: NoteTemplate | null; error: string | null }> {
  if (!user || !accessToken) {
    return { template: null, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/templates/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        ...template
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { template: null, error: data.error || 'Failed to create template' }
    }

    return { template: data.template, error: null }
  } catch (error) {
    return { template: null, error: 'Failed to create template' }
  }
}

export async function deleteNoteTemplate(
  user: User,
  accessToken: string,
  templateId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!user || !accessToken) {
    return { success: false, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/templates/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        template_id: templateId
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete template' }
    }

    return { success: data.success, error: data.error }
  } catch (error) {
    return { success: false, error: 'Failed to delete template' }
  }
}

export function applyTemplateVariables(content: string): string {
  const now = new Date()
  return content
    .replace(/\{\{date\}\}/g, now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    .replace(/\{\{time\}\}/g, now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
}
