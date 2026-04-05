import type { User } from '@supabase/supabase-js'

export interface KGAspect {
  id: string
  name: string
  color: string
  icon?: string
}

export interface KGGoal {
  id: string
  title: string
  aspect_id: string
  aspect_color?: string
  status: string
  target_date?: string
}

export interface KGNote {
  id: string
  title: string
  aspect_id: string
  aspect_color?: string
  aspect_name?: string
  parent_note_id?: string
  updated_at: string
}

export interface EntityLink {
  id: string
  source_type: 'note' | 'goal' | 'aspect'
  source_id: string
  target_type: 'note' | 'goal' | 'aspect'
  target_id: string
}

export interface KnowledgeGraphData {
  aspects: KGAspect[]
  goals: KGGoal[]
  notes: KGNote[]
  links: EntityLink[]
  positions: Record<string, { x: number; y: number }>
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

function buildHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  return headers
}

export async function fetchKnowledgeGraph(
  user: User,
  accessToken: string
): Promise<KnowledgeGraphData & { error: string | null }> {
  try {
    const response = await fetch(`${API_URL}/api/knowledge-graph`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ user_id: user.id }),
    })

    const data = await response.json()
    if (!response.ok) return { aspects: [], goals: [], notes: [], links: [], positions: {}, error: data.error || 'Failed' }

    return {
      aspects: data.aspects || [],
      goals: data.goals || [],
      notes: data.notes || [],
      links: data.links || [],
      positions: data.positions || {},
      error: null,
    }
  } catch {
    return { aspects: [], goals: [], notes: [], links: [], positions: {}, error: 'Failed to fetch knowledge graph' }
  }
}

export async function saveGraphPositions(
  accessToken: string,
  positions: Record<string, { x: number; y: number }>
): Promise<{ error: string | null }> {
  try {
    const response = await fetch(`${API_URL}/api/knowledge-graph/positions`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ positions }),
    })
    const data = await response.json()
    if (!response.ok) return { error: data.error || 'Failed' }
    return { error: null }
  } catch {
    return { error: 'Failed to save positions' }
  }
}

export async function createEntityLink(
  accessToken: string,
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string
): Promise<{ link: { id: string } | null; error: string | null }> {
  try {
    const response = await fetch(`${API_URL}/api/knowledge-graph/link`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ source_type: sourceType, source_id: sourceId, target_type: targetType, target_id: targetId }),
    })

    const data = await response.json()
    if (!response.ok) return { link: null, error: data.error || 'Failed' }
    return { link: data.link, error: null }
  } catch {
    return { link: null, error: 'Failed to create link' }
  }
}

export async function deleteEntityLink(
  accessToken: string,
  linkId: string
): Promise<{ error: string | null }> {
  try {
    const response = await fetch(`${API_URL}/api/knowledge-graph/link/delete`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify({ link_id: linkId }),
    })

    const data = await response.json()
    if (!response.ok) return { error: data.error || 'Failed' }
    return { error: null }
  } catch {
    return { error: 'Failed to delete link' }
  }
}
