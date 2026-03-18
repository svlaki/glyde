import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'
import { ConnectionsStatusCard } from '../components/profile/ConnectionsStatusCard'
import { fetchConnections } from '../lib/connectionService'
import type { Connection } from '../lib/connectionService'

export function ConnectionsPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <ConnectionsPageMobile />
  }

  return <ConnectionsPageDesktop />
}

function useConnectionsData() {
  const { user, session } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user || !session?.access_token) {
      setConnections([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { connections: fetched } = await fetchConnections(user, session.access_token)
      setConnections(fetched)
    } finally {
      setLoading(false)
    }
  }, [user, session])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { connections, loading, refresh }
}

function ConnectionsPageDesktop() {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const { connections, loading, refresh } = useConnectionsData()

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary
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
          background: colors.bgPrimary
        }}>
          <h1 style={{
            ...typography.headingLg,
            fontWeight: 600,
            color: colors.textPrimary,
            margin: 0
          }}>
            Connections
          </h1>
          <p style={{
            ...typography.bodyMd,
            color: colors.textSecondary,
            margin: '8px 0 0 0'
          }}>
            Connect your calendars to keep events in sync automatically.
          </p>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {loading ? (
            <p style={{ ...typography.bodySm, color: colors.textTertiary }}>Loading connections...</p>
          ) : (
            <div style={{ maxWidth: '600px' }}>
              <ConnectionsStatusCard
                connections={connections}
                onConnectionChanged={refresh}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConnectionsPageMobile() {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const { connections, loading, refresh } = useConnectionsData()

  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Connections" showMenu={true} showSearch={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs
      }}>
        {loading ? (
          <p style={{ fontSize: '14px', color: colors.textTertiary }}>Loading connections...</p>
        ) : (
          <ConnectionsStatusCard
            connections={connections}
            onConnectionChanged={refresh}
          />
        )}
      </div>
    </div>
  )
}
