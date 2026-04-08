import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { fetchNoteGraph } from '../lib/notesService'
import { supabase } from '../lib/supabase'

export interface GraphNode {
  id: string
  title: string
  aspect_id: string
  aspect_color: string
  aspect_name: string
  updated_at: string
  val?: number
}

export interface GraphLink {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export function useNoteGraph() {
  const { user, session } = useAuth()
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [isLoading, setIsLoading] = useState(true)
  const initialLoadDone = useRef(false)

  const loadGraph = useCallback(async (background = false) => {
    if (!user || !session?.access_token) return

    if (!background) setIsLoading(true)

    const result = await fetchNoteGraph(user, session.access_token)

    if (!result.error) {
      // Compute node size based on link count
      const linkCounts = new Map<string, number>()
      for (const link of result.links || []) {
        linkCounts.set(link.source, (linkCounts.get(link.source) || 0) + 1)
        linkCounts.set(link.target, (linkCounts.get(link.target) || 0) + 1)
      }

      const nodes: GraphNode[] = (result.nodes || []).map((n: any) => ({
        ...n,
        val: 1 + (linkCounts.get(n.id) || 0),
      }))

      setGraphData({
        nodes,
        links: result.links || [],
      })
    }

    setIsLoading(false)
    initialLoadDone.current = true
  }, [user, session?.access_token])

  useEffect(() => {
    loadGraph(!initialLoadDone.current ? false : true)
  }, [loadGraph])

  // Realtime subscription for notes and note_links changes
  useEffect(() => {
    if (!user) return

    let refreshTimer: NodeJS.Timeout | null = null

    const notesChannel = supabase
      .channel(`note-graph-notes-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadGraph(true), 500)
        }
      )
      .subscribe()

    const linksChannel = supabase
      .channel(`note-graph-links-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_links',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadGraph(true), 500)
        }
      )
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(notesChannel)
      supabase.removeChannel(linksChannel)
    }
  }, [user, loadGraph])

  return { graphData, isLoading, refetch: () => loadGraph(true) }
}
