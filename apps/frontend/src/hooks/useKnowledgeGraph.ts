import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { fetchKnowledgeGraph } from '../lib/knowledgeGraphService'
import type { KnowledgeGraphData } from '../lib/knowledgeGraphService'
import { supabase } from '../lib/supabase'

const EMPTY: KnowledgeGraphData = { aspects: [], goals: [], notes: [], links: [], positions: {} }

export function useKnowledgeGraph() {
  const { user, session } = useAuth()
  const [data, setData] = useState<KnowledgeGraphData>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const initialLoadDone = useRef(false)

  const loadGraph = useCallback(async (background = false) => {
    if (!user || !session?.access_token) return
    if (!background) setIsLoading(true)

    const result = await fetchKnowledgeGraph(user, session.access_token)
    if (!result.error) {
      setData({ aspects: result.aspects, goals: result.goals, notes: result.notes, links: result.links, positions: result.positions })
    }

    setIsLoading(false)
    initialLoadDone.current = true
  }, [user, session?.access_token])

  useEffect(() => {
    loadGraph(!initialLoadDone.current ? false : true)
  }, [loadGraph])

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return

    let refreshTimer: NodeJS.Timeout | null = null
    const debouncedRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => loadGraph(true), 500)
    }

    const tables = ['notes', 'goals', 'entity_links'] as const
    const channels = tables.map(table =>
      supabase
        .channel(`kg-${table}-${user.id}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${user.id}` }, debouncedRefresh)
        .subscribe()
    )

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [user, loadGraph])

  return { data, isLoading, refetch: () => loadGraph(true) }
}
