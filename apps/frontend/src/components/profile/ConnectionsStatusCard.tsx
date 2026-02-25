import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../lib/authContext'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import { triggerSync, getGoogleAuthUrl, handleGoogleCallback, getMicrosoftAuthUrl, handleMicrosoftCallback, disconnectConnection, fetchDisconnectPreview, fetchCalendarMappings, updateCalendarMapping } from '../../lib/connectionService'
import type { Connection, CalendarMapping } from '../../lib/connectionService'
import { CalendarPicker } from './CalendarPicker'

interface ConnectionsStatusCardProps {
  connections: Connection[]
  onConnectionChanged?: () => void
}

const SYNC_STATUS_COLORS: Record<string, { light: string; dark: string }> = {
  synced: { light: 'rgba(34,197,94,0.15)', dark: 'rgba(74,222,128,0.15)' },
  syncing: { light: 'rgba(245,158,11,0.15)', dark: 'rgba(251,191,36,0.15)' },
  pending: { light: 'rgba(245,158,11,0.15)', dark: 'rgba(251,191,36,0.15)' },
  error: { light: 'rgba(239,68,68,0.15)', dark: 'rgba(248,113,113,0.15)' },
}

function formatLastSynced(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function ConnectionRow({ connection, onConnectionChanged }: { connection: Connection; onConnectionChanged?: () => void }) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectConfirm, setDisconnectConfirm] = useState<{ eventCount: number } | null>(null)
  const [calendarsExpanded, setCalendarsExpanded] = useState(false)
  const [mappings, setMappings] = useState<CalendarMapping[]>([])
  const [mappingsLoading, setMappingsLoading] = useState(false)
  const mappingsLoadedRef = useRef(false)

  const statusColors = SYNC_STATUS_COLORS[connection.sync_status] || SYNC_STATUS_COLORS.pending
  const statusBg = isDarkMode ? statusColors.dark : statusColors.light
  const hasCalendarPicker = connection.provider === 'google' || connection.provider === 'microsoft'

  const loadMappings = useCallback(async () => {
    if (!user || !session?.access_token || mappingsLoadedRef.current) return
    setMappingsLoading(true)
    try {
      const result = await fetchCalendarMappings(user, connection.id, session.access_token)
      if (!result.error) {
        setMappings(result.mappings)
        mappingsLoadedRef.current = true
      }
    } finally {
      setMappingsLoading(false)
    }
  }, [user, session, connection.id])

  const handleToggleCalendars = () => {
    const next = !calendarsExpanded
    setCalendarsExpanded(next)
    if (next && !mappingsLoadedRef.current) {
      loadMappings()
    }
  }

  const handleToggleSync = useCallback(async (mapping: CalendarMapping) => {
    if (!user || !session?.access_token) return
    const newSynced = !mapping.is_synced

    // Optimistic update
    setMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, is_synced: newSynced } : m))

    const result = await updateCalendarMapping(
      user,
      mapping.id,
      { is_synced: newSynced },
      session.access_token
    )

    // Revert on failure
    if (result.error) {
      setMappings(prev => prev.map(m => m.id === mapping.id ? { ...m, is_synced: mapping.is_synced } : m))
    }
  }, [user, session])

  const handleSync = async () => {
    if (!user || !session || syncing) return
    setSyncing(true)
    try {
      await triggerSync(user, connection.id, session.access_token)
      onConnectionChanged?.()
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnectClick = async () => {
    if (!user || !session || disconnecting) return
    const preview = await fetchDisconnectPreview(user, connection.id, session.access_token)
    if (!preview.error) {
      setDisconnectConfirm({ eventCount: preview.eventCount })
    }
  }

  const handleDisconnectConfirm = async (deleteEvents: boolean) => {
    if (!user || !session) return
    setDisconnecting(true)
    setDisconnectConfirm(null)
    try {
      await disconnectConnection(user, connection.id, session.access_token, deleteEvents)
      onConnectionChanged?.()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            ...typography.bodySm,
            color: colors.textPrimary,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>{connection.calendar_name || (connection.provider === 'microsoft' ? 'Outlook Calendar' : 'Google Calendar')}</span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '10px',
              background: statusBg,
              fontSize: '11px',
              fontWeight: 500,
              color: colors.textSecondary,
            }}>
              {connection.sync_status}
            </span>
          </div>
          <div style={{ ...typography.labelMd, color: colors.textTertiary, marginTop: '2px' }}>
            Last synced: {formatLastSynced(connection.last_synced_at)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {hasCalendarPicker && (
            <button
              onClick={handleToggleCalendars}
              style={{
                background: 'transparent',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                color: colors.textSecondary,
                ...typography.labelMd,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Calendars
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  transition: 'transform 0.15s ease',
                  transform: calendarsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              background: 'transparent',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: '4px',
              padding: '4px 10px',
              cursor: syncing ? 'default' : 'pointer',
              color: colors.textSecondary,
              ...typography.labelMd,
              opacity: syncing ? 0.5 : 1,
            }}
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={handleDisconnectClick}
            disabled={disconnecting}
            style={{
              background: 'transparent',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: '4px',
              padding: '4px 10px',
              cursor: disconnecting ? 'default' : 'pointer',
              color: colors.textTertiary,
              ...typography.labelMd,
              opacity: disconnecting ? 0.5 : 1,
            }}
          >
            {disconnecting ? '...' : 'Disconnect'}
          </button>
        </div>
      </div>

      {isGoogle && calendarsExpanded && (
        <div style={{ marginTop: '8px', paddingLeft: '4px' }}>
          <CalendarPicker
            mappings={mappings}
            onToggleSync={handleToggleSync}
            loading={mappingsLoading}
          />
        </div>
      )}

      {disconnectConfirm && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          borderRadius: '6px',
          border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
          backgroundColor: isDarkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
        }}>
          <div style={{ ...typography.bodySm, color: colors.textPrimary, marginBottom: '8px' }}>
            {disconnectConfirm.eventCount > 0
              ? `This connection has ${disconnectConfirm.eventCount} synced event${disconnectConfirm.eventCount === 1 ? '' : 's'}. What would you like to do with them?`
              : 'Disconnect this calendar?'}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {disconnectConfirm.eventCount > 0 && (
              <>
                <button
                  onClick={() => handleDisconnectConfirm(false)}
                  style={{
                    background: colors.bgTertiary,
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: '4px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    color: colors.textPrimary,
                    ...typography.labelMd,
                    fontWeight: 500,
                  }}
                >
                  Keep events
                </button>
                <button
                  onClick={() => handleDisconnectConfirm(true)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: '4px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    color: '#ef4444',
                    ...typography.labelMd,
                    fontWeight: 500,
                  }}
                >
                  Delete events
                </button>
              </>
            )}
            {disconnectConfirm.eventCount === 0 && (
              <button
                onClick={() => handleDisconnectConfirm(false)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)'}`,
                  borderRadius: '4px',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  color: '#ef4444',
                  ...typography.labelMd,
                  fontWeight: 500,
                }}
              >
                Confirm
              </button>
            )}
            <button
              onClick={() => setDisconnectConfirm(null)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 12px',
                cursor: 'pointer',
                color: colors.textTertiary,
                ...typography.labelMd,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ConnectionsStatusCard({ connections, onConnectionChanged }: ConnectionsStatusCardProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const onConnectionChangedRef = useRef(onConnectionChanged)

  // Keep ref in sync without retriggering useEffect
  useEffect(() => {
    onConnectionChangedRef.current = onConnectionChanged
  }, [onConnectionChanged])

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  // Listen for OAuth callback postMessage from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from our popup (source check is sufficient;
      // origin check removed because the OAuth redirect URI may land on
      // a different origin than the opener, e.g., production vs localhost)
      if (popupRef.current && event.source !== popupRef.current) return

      const { type, code, state, error } = event.data || {}

      if (type === 'GOOGLE_CONNECTION_CALLBACK' || type === 'MICROSOFT_CONNECTION_CALLBACK') {
        if (error) {
          setConnectError(`OAuth error: ${error}`)
          setConnecting(false)
          popupRef.current = null
          return
        }

        if (code && state && user && session) {
          try {
            setConnectError(null)
            const handler = type === 'MICROSOFT_CONNECTION_CALLBACK'
              ? handleMicrosoftCallback
              : handleGoogleCallback
            const result = await handler(user, code, state, session.access_token)
            if (result.error) {
              setConnectError(result.error)
            } else {
              onConnectionChangedRef.current?.()
            }
          } catch (err: any) {
            setConnectError(err.message || 'Failed to connect calendar')
          }
        }
        popupRef.current = null
        setConnecting(false)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user, session])

  // Detect popup closed without completing OAuth
  useEffect(() => {
    if (!connecting || !popupRef.current) return

    const interval = setInterval(() => {
      if (popupRef.current?.closed) {
        popupRef.current = null
        setConnecting(false)
        clearInterval(interval)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [connecting])

  const openOAuthPopup = async (provider: 'google' | 'microsoft') => {
    if (!user || !session || connecting) return
    setConnecting(true)
    setConnectError(null)
    try {
      const getAuthUrl = provider === 'microsoft' ? getMicrosoftAuthUrl : getGoogleAuthUrl
      const { authUrl, error: urlError } = await getAuthUrl(user, session.access_token)
      if (urlError || !authUrl) {
        setConnectError(urlError || 'Failed to get authorization URL')
        setConnecting(false)
        return
      }

      const width = 500
      const height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        authUrl,
        `${provider}-oauth`,
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      )

      if (!popup) {
        setConnectError('Popup blocked. Please allow popups for this site.')
        setConnecting(false)
      } else {
        popupRef.current = popup
      }
    } catch (err: any) {
      setConnectError(err.message || 'Failed to start connection')
      setConnecting(false)
    }
  }

  const handleConnect = () => openOAuthPopup('google')
  const handleConnectMicrosoft = () => openOAuthPopup('microsoft')

  return (
    <div style={{
      background: colors.bgPrimary,
      border: `1px solid ${borderColor}`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: isMobile ? '14px 16px 10px' : '16px 20px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ ...typography.headingMd, color: colors.textPrimary }}>
          Connections
        </div>
        <span style={{ ...typography.labelMd, color: colors.textTertiary }}>
          {connections.length} connected
        </span>
      </div>

      <div style={{ padding: isMobile ? '0 16px 14px' : '0 20px 16px' }}>
        {connectError && (
          <div style={{
            padding: '8px 12px',
            marginBottom: '8px',
            borderRadius: '6px',
            backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.15)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ ...typography.labelMd, color: '#ef4444' }}>{connectError}</span>
            <button
              onClick={() => setConnectError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '0 4px',
                fontSize: '16px',
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>
        )}
        {connections.length === 0 ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ ...typography.bodySm, color: colors.textTertiary, marginBottom: '10px' }}>
              Connect a calendar to sync your events
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{
                  background: colors.bgTertiary,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: connecting ? 'default' : 'pointer',
                  color: colors.textPrimary,
                  ...typography.bodySm,
                  fontWeight: 500,
                  opacity: connecting ? 0.5 : 1,
                }}
              >
                {connecting ? 'Connecting...' : 'Google Calendar'}
              </button>
              <button
                onClick={handleConnectMicrosoft}
                disabled={connecting}
                style={{
                  background: colors.bgTertiary,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: connecting ? 'default' : 'pointer',
                  color: colors.textPrimary,
                  ...typography.bodySm,
                  fontWeight: 500,
                  opacity: connecting ? 0.5 : 1,
                }}
              >
                {connecting ? 'Connecting...' : 'Outlook'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {connections.map(conn => (
              <ConnectionRow key={conn.id} connection={conn} onConnectionChanged={onConnectionChanged} />
            ))}
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{
                  background: 'transparent',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '4px',
                  padding: '4px 12px',
                  cursor: connecting ? 'default' : 'pointer',
                  color: colors.textTertiary,
                  ...typography.labelMd,
                  opacity: connecting ? 0.5 : 1,
                }}
              >
                {connecting ? 'Connecting...' : '+ Google'}
              </button>
              <button
                onClick={handleConnectMicrosoft}
                disabled={connecting}
                style={{
                  background: 'transparent',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '4px',
                  padding: '4px 12px',
                  cursor: connecting ? 'default' : 'pointer',
                  color: colors.textTertiary,
                  ...typography.labelMd,
                  opacity: connecting ? 0.5 : 1,
                }}
              >
                {connecting ? 'Connecting...' : '+ Outlook'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
