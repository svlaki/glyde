import { useState } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useConnections } from '../lib/connectionContext'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

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

function CalendarIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 2V6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 2V6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 10H21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function FileIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2v6h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 18v-6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <path d="M9 15l3-3 3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface ComingSoonItemProps {
  icon: React.ReactNode
  label: string
  colors: ReturnType<typeof getColors>
  isMobile?: boolean
}

function ComingSoonItem({ icon, label, colors, isMobile }: ComingSoonItemProps) {
  return (
    <div style={{
      padding: isMobile ? '16px 20px' : '14px 24px',
      background: colors.bgTertiary,
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      opacity: 0.5,
      minHeight: isMobile ? '56px' : 'auto',
    }}>
      {icon}
      <span style={{
        fontSize: isMobile ? '15px' : '14px',
        color: colors.textTertiary,
        flex: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '12px',
        color: colors.textTertiary,
        background: colors.bgSecondary,
        padding: '4px 10px',
        borderRadius: '4px',
      }}>
        Coming Soon
      </span>
    </div>
  )
}

function GoogleConnectionSection({ isMobile }: { isMobile: boolean }) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)
  const { connections, connectGoogle, disconnect, triggerSync, isLoading } = useConnections()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const googleConnections = connections.filter(c => c.provider === 'google')
  const hasGoogle = googleConnections.length > 0

  const handleConnect = async () => {
    setActionLoading('connect')
    try {
      await connectGoogle()
    } finally {
      setActionLoading(null)
    }
  }

  const handleSync = async (connectionId: string) => {
    setActionLoading(`sync-${connectionId}`)
    try {
      await triggerSync(connectionId)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    setActionLoading(`disconnect-${connectionId}`)
    try {
      await disconnect(connectionId)
    } finally {
      setActionLoading(null)
    }
  }

  if (!hasGoogle) {
    return (
      <div style={{
        padding: isMobile ? '16px 20px' : '14px 24px',
        background: colors.bgTertiary,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: isMobile ? '56px' : 'auto',
      }}>
        <CalendarIcon color={colors.textPrimary} />
        <span style={{
          fontSize: isMobile ? '15px' : '14px',
          color: colors.textPrimary,
          flex: 1,
        }}>
          Google Calendar
        </span>
        <button
          onClick={handleConnect}
          disabled={actionLoading === 'connect' || isLoading}
          style={{
            fontSize: '12px',
            color: colors.textPrimary,
            background: colors.bgSecondary,
            padding: '6px 14px',
            borderRadius: '4px',
            border: 'none',
            cursor: actionLoading === 'connect' ? 'default' : 'pointer',
            fontWeight: 500,
            opacity: actionLoading === 'connect' ? 0.5 : 1,
          }}
        >
          {actionLoading === 'connect' ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    )
  }

  return (
    <>
      {googleConnections.map(conn => {
        const statusColors = SYNC_STATUS_COLORS[conn.sync_status] || SYNC_STATUS_COLORS.pending
        const statusBg = isDarkMode ? statusColors.dark : statusColors.light

        return (
          <div
            key={conn.id}
            style={{
              padding: isMobile ? '16px 20px' : '14px 24px',
              background: colors.bgTertiary,
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CalendarIcon color={colors.textPrimary} />
              <span style={{
                fontSize: isMobile ? '15px' : '14px',
                color: colors.textPrimary,
                flex: 1,
              }}>
                {conn.calendar_name || 'Google Calendar'}
              </span>
              <span style={{
                padding: '3px 10px',
                borderRadius: '10px',
                background: statusBg,
                fontSize: '11px',
                fontWeight: 500,
                color: colors.textSecondary,
              }}>
                {conn.sync_status}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: '32px',
            }}>
              <span style={{ ...typography.labelMd, color: colors.textTertiary }}>
                Last synced: {formatLastSynced(conn.last_synced_at)}
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleSync(conn.id)}
                  disabled={actionLoading === `sync-${conn.id}`}
                  style={{
                    fontSize: '12px',
                    color: colors.textSecondary,
                    background: colors.bgSecondary,
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: actionLoading === `sync-${conn.id}` ? 'default' : 'pointer',
                    opacity: actionLoading === `sync-${conn.id}` ? 0.5 : 1,
                  }}
                >
                  {actionLoading === `sync-${conn.id}` ? 'Syncing...' : 'Sync'}
                </button>
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  disabled={actionLoading === `disconnect-${conn.id}`}
                  style={{
                    fontSize: '12px',
                    color: colors.textTertiary,
                    background: 'transparent',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                    cursor: actionLoading === `disconnect-${conn.id}` ? 'default' : 'pointer',
                    opacity: actionLoading === `disconnect-${conn.id}` ? 0.5 : 1,
                  }}
                >
                  {actionLoading === `disconnect-${conn.id}` ? '...' : 'Disconnect'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function ConnectionsContent({ isMobile }: { isMobile: boolean }) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '12px' : '8px',
    }}>
      <GoogleConnectionSection isMobile={isMobile} />

      <ComingSoonItem
        icon={<CalendarIcon color={colors.textTertiary} />}
        label="Outlook Calendar"
        colors={colors}
        isMobile={isMobile}
      />
      <ComingSoonItem
        icon={<CalendarIcon color={colors.textTertiary} />}
        label="Apple Calendar"
        colors={colors}
        isMobile={isMobile}
      />
      <ComingSoonItem
        icon={<FileIcon color={colors.textTertiary} />}
        label="Import .ics file"
        colors={colors}
        isMobile={isMobile}
      />
    </div>
  )
}

export function ConnectionsPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <ConnectionsPageMobile />
  }

  return <ConnectionsPageDesktop />
}

function ConnectionsPageDesktop() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const typography = getTypography(false)

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary,
    }}>
      <VerticalSidebar />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft: `${SIDEBAR_WIDTH}px`,
        padding: '0 24px',
      }}>
        <div style={{
          padding: '24px 20px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgPrimary,
        }}>
          <h1 style={{
            ...typography.headingXl,
            fontWeight: 600,
            color: colors.textPrimary,
            margin: 0,
          }}>
            Connections
          </h1>
          <p style={{
            ...typography.bodyMd,
            color: colors.textSecondary,
            margin: '8px 0 0 0',
          }}>
            Manage your calendar integrations.
          </p>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}>
          <ConnectionsContent isMobile={false} />
        </div>

        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${colors.border}`,
          background: colors.bgPrimary,
        }}>
          <p style={{
            ...typography.bodySm,
            color: colors.textSecondary,
            margin: 0,
            textAlign: 'center',
          }}>
            Calendar sync keeps your events in sync automatically.
          </p>
        </div>
      </div>
    </div>
  )
}

function ConnectionsPageMobile() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Connections" showMenu={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs,
      }}>
        <p style={{
          fontSize: '14px',
          color: colors.textSecondary,
          margin: '0 0 24px 0',
          lineHeight: '1.5',
        }}>
          Manage your calendar integrations.
        </p>

        <ConnectionsContent isMobile={true} />

        <p style={{
          fontSize: '12px',
          color: colors.textTertiary,
          margin: '32px 0 0 0',
          textAlign: 'center',
          lineHeight: '1.5',
        }}>
          Calendar sync keeps your events in sync automatically.
        </p>
      </div>
    </div>
  )
}
