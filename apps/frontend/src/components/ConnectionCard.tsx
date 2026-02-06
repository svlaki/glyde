import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import type { Connection } from '../lib/connectionService'

interface ConnectionCardProps {
  connection: Connection
  onSync: () => void
  onDisconnect: () => void
  isSyncing?: boolean
}

export function ConnectionCard({ connection, onSync, onDisconnect, isSyncing }: ConnectionCardProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const providerLabels: Record<string, string> = {
    google: 'Google Calendar',
    microsoft: 'Outlook Calendar'
  }

  const statusColors: Record<string, string> = {
    synced: '#10b981',
    syncing: '#3b82f6',
    pending: '#f59e0b',
    error: '#ef4444'
  }

  const statusLabels: Record<string, string> = {
    synced: 'Synced',
    syncing: 'Syncing...',
    pending: 'Pending',
    error: 'Error'
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const actualSyncStatus = isSyncing ? 'syncing' : connection.sync_status

  return (
    <div style={{
      padding: '16px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      background: colors.bgPrimary
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Provider Icon */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: connection.provider === 'google' ? '#4285f420' : '#0078d420',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {connection.provider === 'google' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 2V6" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 2V6" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 10H21" stroke="#4285f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="#0078d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 2V6" stroke="#0078d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 2V6" stroke="#0078d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 10H21" stroke="#0078d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>

          <div>
            <h3 style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.medium,
              color: colors.textPrimary,
              margin: 0
            }}>
              {providerLabels[connection.provider] || connection.provider}
            </h3>
            {connection.calendar_name && (
              <p style={{
                fontSize: fontSize.sm,
                color: colors.textSecondary,
                margin: '2px 0 0 0'
              }}>
                {connection.calendar_name}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <span style={{
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          background: `${statusColors[actualSyncStatus]}15`,
          color: statusColors[actualSyncStatus]
        }}>
          {statusLabels[actualSyncStatus] || actualSyncStatus}
        </span>
      </div>

      {/* Error Message */}
      {connection.sync_error && connection.sync_status === 'error' && (
        <p style={{
          fontSize: fontSize.xs,
          color: '#ef4444',
          margin: '12px 0 0 0',
          padding: '8px 12px',
          background: '#ef444410',
          borderRadius: '4px'
        }}>
          {connection.sync_error}
        </p>
      )}

      {/* Actions */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onSync}
            disabled={actualSyncStatus === 'syncing'}
            style={{
              padding: '6px 12px',
              fontSize: fontSize.xs,
              background: 'transparent',
              color: actualSyncStatus === 'syncing' ? colors.textTertiary : colors.textSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              cursor: actualSyncStatus === 'syncing' ? 'not-allowed' : 'pointer',
              opacity: actualSyncStatus === 'syncing' ? 0.6 : 1
            }}
          >
            {actualSyncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            onClick={onDisconnect}
            style={{
              padding: '6px 12px',
              fontSize: fontSize.xs,
              background: 'transparent',
              color: '#c66',
              border: '1px solid #c66',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        </div>

        {/* Last Synced */}
        <span style={{
          fontSize: fontSize.xs,
          color: colors.textTertiary
        }}>
          Last synced: {formatDate(connection.last_synced_at)}
        </span>
      </div>
    </div>
  )
}
