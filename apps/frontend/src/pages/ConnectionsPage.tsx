import { useDarkMode } from '../lib/darkModeContext'
import { PageHeader } from '../components/PageHeader'
import { getColors } from '../styles/colors'

export function ConnectionsPage() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      {/* Header */}
      <PageHeader />

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Page Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgSecondary
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: colors.textPrimary,
            margin: 0
          }}>
            Connections
          </h1>
          <p style={{
            fontSize: '14px',
            color: colors.textSecondary,
            margin: '8px 0 0 0'
          }}>
            Calendar integrations are coming soon.
          </p>
        </div>

        {/* Connections List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {/* All Calendar Options - Coming Soon */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* Google Calendar */}
            <div style={{
              padding: '14px 24px',
              background: colors.bgTertiary,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              opacity: 0.5
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 2V6" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 2V6" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 10H21" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '14px', color: colors.textTertiary, flex: 1 }}>
                Google Calendar
              </span>
              <span style={{ fontSize: '12px', color: colors.textTertiary, background: colors.bgSecondary, padding: '2px 8px', borderRadius: '4px' }}>
                Coming Soon
              </span>
            </div>

            {/* Outlook Calendar */}
            <div style={{
              padding: '14px 24px',
              background: colors.bgTertiary,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              opacity: 0.5
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 2V6" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 2V6" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 10H21" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '14px', color: colors.textTertiary, flex: 1 }}>
                Outlook Calendar
              </span>
              <span style={{ fontSize: '12px', color: colors.textTertiary, background: colors.bgSecondary, padding: '2px 8px', borderRadius: '4px' }}>
                Coming Soon
              </span>
            </div>

            {/* Apple Calendar */}
            <div style={{
              padding: '14px 24px',
              background: colors.bgTertiary,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              opacity: 0.5
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" stroke={colors.textTertiary} strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: '14px', color: colors.textTertiary, flex: 1 }}>
                Apple Calendar
              </span>
              <span style={{ fontSize: '12px', color: colors.textTertiary, background: colors.bgSecondary, padding: '2px 8px', borderRadius: '4px' }}>
                Coming Soon
              </span>
            </div>

            {/* iCal Import */}
            <div style={{
              padding: '14px 24px',
              background: colors.bgTertiary,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              opacity: 0.5
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 18v-6" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round"/>
                <path d="M9 15l3-3 3 3" stroke={colors.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '14px', color: colors.textTertiary, flex: 1 }}>
                Import .ics file
              </span>
              <span style={{ fontSize: '12px', color: colors.textTertiary, background: colors.bgSecondary, padding: '2px 8px', borderRadius: '4px' }}>
                Coming Soon
              </span>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${colors.border}`,
          background: colors.bgSecondary
        }}>
          <p style={{
            fontSize: '12px',
            color: colors.textSecondary,
            margin: 0,
            textAlign: 'center'
          }}>
            Calendar sync will allow you to keep your events in sync automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
