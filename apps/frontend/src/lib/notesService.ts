import type { User } from '@supabase/supabase-js'

export interface Note {
  id: string
  user_id: string
  title: string
  content?: string
  aspect_id: string
  aspect_name?: string
  aspect_color?: string
  aspect_icon?: string
  horizon_start?: string
  horizon_end?: string
  status: 'draft' | 'active' | 'archived' | 'scribe'
  source?: 'user' | 'scribe' | 'agent'
  created_at: string
  updated_at: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchUserNotes(
  user: User,
  accessToken: string
): Promise<{ notes: Note[]; error: string | null }> {
  if (!user || !accessToken) {
    return { notes: [], error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id })
    })

    const data = await response.json()

    if (!response.ok) {
      return { notes: [], error: data.error || 'Failed to fetch notes' }
    }

    return { notes: data.notes || [], error: null }
  } catch (error) {
    console.error('Error fetching notes:', error)
    return { notes: [], error: 'Failed to fetch notes' }
  }
}

export async function createUserNotes(
  user: User,
  accessToken: string,
  notesData: {
    title?: string
    content?: string
    aspect_id?: string
    horizon_start?: string
    horizon_end?: string
    status?: 'draft' | 'active' | 'archived'
  }
): Promise<{ note: Note | null; error: string | null }> {
  if (!user || !accessToken) {
    return { note: null, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        ...notesData
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { note: null, error: data.error || 'Failed to create notes' }
    }

    return { note: data.note, error: null }
  } catch (error) {
    console.error('Error creating notes:', error)
    return { note: null, error: 'Failed to create notes' }
  }
}

export async function updateUserNotes(
  user: User,
  accessToken: string,
  notesId: string,
  updates: {
    title?: string
    content?: string
    aspect_id?: string
    horizon_start?: string
    horizon_end?: string
    status?: 'draft' | 'active' | 'archived'
  }
): Promise<{ note: Note | null; error: string | null }> {
  if (!user || !accessToken) {
    return { note: null, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        plan_id: notesId,
        ...updates
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { note: null, error: data.error || 'Failed to update notes' }
    }

    return { note: data.note, error: null }
  } catch (error) {
    console.error('Error updating notes:', error)
    return { note: null, error: 'Failed to update notes' }
  }
}

export async function deleteUserNotes(
  user: User,
  accessToken: string,
  notesId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!user || !accessToken) {
    return { success: false, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        plan_id: notesId
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete notes' }
    }

    return { success: data.success, error: data.error }
  } catch (error) {
    console.error('Error deleting notes:', error)
    return { success: false, error: 'Failed to delete notes' }
  }
}

export async function fetchNoteGraph(
  user: User,
  accessToken: string
): Promise<{ nodes: any[]; links: any[]; error: string | null }> {
  if (!user || !accessToken) {
    return { nodes: [], links: [], error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/graph`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id })
    })

    const data = await response.json()

    if (!response.ok) {
      return { nodes: [], links: [], error: data.error || 'Failed to fetch note graph' }
    }

    return { nodes: data.nodes || [], links: data.links || [], error: null }
  } catch (error) {
    console.error('Error fetching note graph:', error)
    return { nodes: [], links: [], error: 'Failed to fetch note graph' }
  }
}

export async function syncNoteLinks(
  user: User,
  accessToken: string,
  sourceNoteId: string,
  linkedTitles: string[]
): Promise<{ success: boolean; error: string | null }> {
  if (!user || !accessToken) {
    return { success: false, error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/links/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        source_note_id: sourceNoteId,
        linked_titles: linkedTitles
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to sync note links' }
    }

    return { success: data.success, error: data.error }
  } catch (error) {
    console.error('Error syncing note links:', error)
    return { success: false, error: 'Failed to sync note links' }
  }
}

export interface Backlink {
  id: string
  title: string
  content?: string
  aspect_name?: string
  aspect_color?: string
  updated_at: string
}

export async function fetchNoteBacklinks(
  user: User,
  accessToken: string,
  noteId: string
): Promise<{ backlinks: Backlink[]; error: string | null }> {
  if (!user || !accessToken) {
    return { backlinks: [], error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/backlinks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        note_id: noteId
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { backlinks: [], error: data.error || 'Failed to fetch backlinks' }
    }

    return { backlinks: data.backlinks || [], error: null }
  } catch (error) {
    return { backlinks: [], error: 'Failed to fetch backlinks' }
  }
}

export interface SearchResult {
  id: string
  title: string
  content?: string
  aspect_id?: string
  aspect_color?: string
  aspect_name?: string
  updated_at: string
  rank?: number
}

export async function searchNotesFulltext(
  user: User,
  accessToken: string,
  query: string
): Promise<{ notes: SearchResult[]; error: string | null }> {
  if (!user || !accessToken) {
    return { notes: [], error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/search/fulltext`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        query
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { notes: [], error: data.error || 'Failed to search notes' }
    }

    return { notes: data.notes || [], error: null }
  } catch (error) {
    return { notes: [], error: 'Failed to search notes' }
  }
}

export async function searchNotesByTitle(
  user: User,
  accessToken: string,
  query: string
): Promise<{ notes: any[]; error: string | null }> {
  if (!user || !accessToken) {
    return { notes: [], error: 'User not authenticated' }
  }

  try {
    const response = await fetch(`${API_URL}/api/notes/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        user_id: user.id,
        query
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return { notes: [], error: data.error || 'Failed to search notes' }
    }

    return { notes: data.notes || [], error: null }
  } catch (error) {
    console.error('Error searching notes:', error)
    return { notes: [], error: 'Failed to search notes' }
  }
}
