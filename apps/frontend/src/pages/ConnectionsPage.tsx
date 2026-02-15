import { useTheme } from '../lib/themeContext'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

export function ConnectionsPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <ConnectionsPageMobile />
  }

  return <ConnectionsPageDesktop />
}

// Reusable connection item component
interface ConnectionItemProps {
  icon: React.ReactNode
  label: string
  status: 'coming_soon' | 'connected' | 'connect'
  colors: ReturnType<typeof getColors>
  isMobile?: boolean
}

function ConnectionItem({ icon, label, status, colors, isMobile }: ConnectionItemProps) {
  return (
    <div style={{
      padding: isMobile ? '16px 20px' : '14px 24px',
      background: colors.bgTertiary,
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      opacity: status === 'coming_soon' ? 0.5 : 1,
      minHeight: isMobile ? '56px' : 'auto'
    }}>
      {icon}
      <span style={{
        fontSize: isMobile ? '15px' : '14px',
        color: status === 'coming_soon' ? colors.textTertiary : colors.textPrimary,
        flex: 1
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '12px',
        color: colors.textTertiary,
        background: colors.bgSecondary,
        padding: '4px 10px',
        borderRadius: '4px'
      }}>
        {status === 'coming_soon' ? 'Coming Soon' : status === 'connected' ? 'Connected' : 'Connect'}
      </span>
    </div>
  )
}

// Calendar icon component
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

// File icon component
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

function ConnectionsPageDesktop() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary
    }}>
      {/* Vertical Sidebar */}
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
            ...typography.headingXl,
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
            Calendar integrations are coming soon.
          </p>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <ConnectionItem
              icon={<CalendarIcon color={colors.textTertiary} />}
              label="Google Calendar"
              status="coming_soon"
              colors={colors}
            />
            <ConnectionItem
              icon={<CalendarIcon color={colors.textTertiary} />}
              label="Outlook Calendar"
              status="coming_soon"
              colors={colors}
            />
            <ConnectionItem
              icon={<CalendarIcon color={colors.textTertiary} />}
              label="Apple Calendar"
              status="coming_soon"
              colors={colors}
            />
            <ConnectionItem
              icon={<FileIcon color={colors.textTertiary} />}
              label="Import .ics file"
              status="coming_soon"
              colors={colors}
            />
          </div>
        </div>

        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${colors.border}`,
          background: colors.bgPrimary
        }}>
          <p style={{
            ...typography.bodySm,
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

function ConnectionsPageMobile() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)

  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Connections" showMenu={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs
      }}>
        {/* Description */}
        <p style={{
          fontSize: '14px',
          color: colors.textSecondary,
          margin: '0 0 24px 0',
          lineHeight: '1.5'
        }}>
          Calendar integrations are coming soon. Connect your calendars to keep events in sync automatically.
        </p>

        {/* Connections List */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <ConnectionItem
            icon={<CalendarIcon color={colors.textTertiary} />}
            label="Google Calendar"
            status="coming_soon"
            colors={colors}
            isMobile
          />
          <ConnectionItem
            icon={<CalendarIcon color={colors.textTertiary} />}
            label="Outlook Calendar"
            status="coming_soon"
            colors={colors}
            isMobile
          />
          <ConnectionItem
            icon={<CalendarIcon color={colors.textTertiary} />}
            label="Apple Calendar"
            status="coming_soon"
            colors={colors}
            isMobile
          />
          <ConnectionItem
            icon={<FileIcon color={colors.textTertiary} />}
            label="Import .ics file"
            status="coming_soon"
            colors={colors}
            isMobile
          />
        </div>

        {/* Info Footer */}
        <p style={{
          fontSize: '12px',
          color: colors.textTertiary,
          margin: '32px 0 0 0',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          Calendar sync will allow you to keep your events in sync automatically.
        </p>
      </div>
    </div>
  )
}
