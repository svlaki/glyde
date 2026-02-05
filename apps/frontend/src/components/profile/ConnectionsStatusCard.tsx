import { useState } from 'react'
import { useAuth } from '../../lib/authContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import { Connection, triggerSync, getGoogleAuthUrl } from '../../lib/connectionService'

interface ConnectionsStatusCardProps {
  connections: Connection[]
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

function ConnectionRow({ connection }: { connection: Connection }) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)
  const [syncing, setSyncing] = useState(false)

  const statusColors = SYNC_STATUS_COLORS[connection.sync_status] || SYNC_STATUS_COLORS.pending
  const statusBg = isDarkMode ? statusColors.dark : statusColors.light

  const handleSync = async () => {
    if (!user || !session || syncing) return
    setSyncing(true)
    try {
      await triggerSync(user, connection.id, session.access_token)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...typography.bodySm,
          color: colors.textPrimary,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>{connection.calendar_name || 'Google Calendar'}</span>
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
          flexShrink: 0,
        }}
      >
        {syncing ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  )
}

export function ConnectionsStatusCard({ connections }: ConnectionsStatusCardProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)
  const [connecting, setConnecting] = useState(false)

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const handleConnect = async () => {
    if (!user || !session || connecting) return
    setConnecting(true)
    try {
      const { authUrl } = await getGoogleAuthUrl(user, session.access_token)
      if (authUrl) {
        window.location.href = authUrl
      }
    } finally {
      setConnecting(false)
    }
  }

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
        {connections.length === 0 ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ ...typography.bodySm, color: colors.textTertiary, marginBottom: '10px' }}>
              Connect a calendar to sync your events
            </div>
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
              {connecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          </div>
        ) : (
          <>
            {connections.map(conn => (
              <ConnectionRow key={conn.id} connection={conn} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
