import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from './authContext'
import {
  Connection,
  fetchConnections,
  getGoogleAuthUrl,
  handleGoogleCallback,
  triggerSync as triggerSyncApi,
  disconnectConnection as disconnectApi
} from './connectionService'

interface ConnectionContextValue {
  connections: Connection[]
  isLoading: boolean
  error: string | null
  refreshConnections: () => Promise<void>
  connectGoogle: () => Promise<{ success: boolean; error?: string }>
  disconnect: (connectionId: string) => Promise<{ success: boolean; error?: string }>
  triggerSync: (connectionId: string) => Promise<{ success: boolean; error?: string }>
}

const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshConnections = useCallback(async () => {
    if (!user) {
      setConnections([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { connections: fetched, error: fetchError } = await fetchConnections(
        user,
        session?.access_token
      )

      if (fetchError) {
        setError(fetchError)
        setConnections([])
      } else {
        setConnections(fetched)
      }
    } catch (err) {
      setError('Failed to load connections')
      setConnections([])
    } finally {
      setIsLoading(false)
    }
  }, [user, session])

  // Load connections when user changes
  useEffect(() => {
    if (user) {
      refreshConnections()
    } else {
      setConnections([])
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Handle OAuth callback messages from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Skip strict origin check - OAuth redirect may land on a different
      // origin than the opener (e.g., production redirect URI vs localhost)
      if (!event.data?.type) return

      const { type, code, state, error: oauthError } = event.data || {}

      if (type === 'GOOGLE_CONNECTION_CALLBACK') {
        if (oauthError) {
          setError(oauthError)
          return
        }

        if (code && state && user) {
          // Exchange code for tokens
          const { connection, error: callbackError } = await handleGoogleCallback(
            user,
            code,
            state,
            session?.access_token
          )

          if (callbackError) {
            setError(callbackError)
          } else if (connection) {
            // Add new connection to state
            setConnections(prev => {
              // Replace if exists, otherwise add
              const exists = prev.some(c => c.id === connection.id)
              if (exists) {
                return prev.map(c => c.id === connection.id ? connection : c)
              }
              return [connection, ...prev]
            })
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user, session])

  const connectGoogle = useCallback(async () => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Get OAuth URL
    const { authUrl, error: urlError } = await getGoogleAuthUrl(
      user,
      session?.access_token
    )

    if (urlError || !authUrl) {
      return { success: false, error: urlError || 'Failed to get authorization URL' }
    }

    // Open OAuth popup
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    )

    if (!popup) {
      return { success: false, error: 'Failed to open authorization window. Please allow popups.' }
    }

    // The callback will be handled by the message listener
    return { success: true }
  }, [user, session])

  const disconnect = useCallback(async (connectionId: string) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { success, error: disconnectError } = await disconnectApi(
      user,
      connectionId,
      session?.access_token
    )

    if (!success) {
      return { success: false, error: disconnectError || 'Failed to disconnect' }
    }

    // Remove from state
    setConnections(prev => prev.filter(c => c.id !== connectionId))
    return { success: true }
  }, [user, session])

  const triggerSync = useCallback(async (connectionId: string) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Update status optimistically
    setConnections(prev => prev.map(c =>
      c.id === connectionId ? { ...c, sync_status: 'syncing' as const } : c
    ))

    const { success, error: syncError } = await triggerSyncApi(
      user,
      connectionId,
      session?.access_token
    )

    if (!success) {
      // Revert on error
      setConnections(prev => prev.map(c =>
        c.id === connectionId ? { ...c, sync_status: 'error' as const, sync_error: syncError || 'Sync failed' } : c
      ))
      return { success: false, error: syncError || 'Failed to trigger sync' }
    }

    // Refresh after a delay to get updated status
    setTimeout(() => {
      refreshConnections()
    }, 2000)

    return { success: true }
  }, [user, session, refreshConnections])

  return (
    <ConnectionContext.Provider value={{
      connections,
      isLoading,
      error,
      refreshConnections,
      connectGoogle,
      disconnect,
      triggerSync
    }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnections() {
  const context = useContext(ConnectionContext)
  if (!context) {
    throw new Error('useConnections must be used within a ConnectionProvider')
  }
  return context
}
