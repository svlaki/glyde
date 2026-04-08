import { Drawer } from 'vaul'
import { useAuth } from '../../lib/authContext'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { ThemePicker } from '../ui/ThemePicker'
import { getTypography } from '../../styles/typography'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { signOut, preferredName, user } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(true) // Mobile context
  const displayName = preferredName || user?.email?.split('@')[0] || 'there'

  const handleSignOut = () => {
    onClose()
    signOut()
  }

  const menuItemStyle = {
    display: 'block',
    padding: '12px 16px',
    ...typography.bodyLg,
    color: colors.textPrimary,
    textDecoration: 'none',
    borderRadius: '8px',
    marginBottom: '8px',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    cursor: 'pointer'
  }

  const getActiveStyle = (path: string) => ({
    ...menuItemStyle,
    background: window.location.pathname === path ? colors.bgHover : 'transparent'
  })

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()} direction="left">
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            background: colors.bgSecondary,
            zIndex: 1000,
            paddingTop: 'env(safe-area-inset-top)',
            display: 'flex',
            flexDirection: 'column',
            outline: 'none'
          }}
        >
          {/* Menu header */}
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.border}`
          }}>
            <Drawer.Title className="serif" style={{
              ...typography.displaySm,
              fontWeight: 700,
              margin: 0,
              color: colors.textPrimary
            }}>
              Glyde
            </Drawer.Title>
            <p style={{
              ...typography.bodyMd,
              color: colors.textSecondary,
              margin: '8px 0 0 0'
            }}>
              Hello, {displayName}
            </p>
          </div>

          {/* Menu items */}
          <div style={{ flex: 1, padding: '20px' }}>
            <a href="/calendar" onClick={onClose} style={getActiveStyle('/calendar')}>
              Calendar
            </a>
            <a href="/notes" onClick={onClose} style={getActiveStyle('/notes')}>
              Notes
            </a>
            <a href="/goals" onClick={onClose} style={getActiveStyle('/goals')}>
              Goals
            </a>
            <a href="/aspects" onClick={onClose} style={getActiveStyle('/aspects')}>
              Aspects
            </a>
            <a href="/friends" onClick={onClose} style={getActiveStyle('/friends')}>
              Friends
            </a>
            <a href="/ratings" onClick={onClose} style={getActiveStyle('/ratings')}>
              Ratings
            </a>
            <a href="/connections" onClick={onClose} style={getActiveStyle('/connections')}>
              Connections
            </a>
            <a href="/profile" onClick={onClose} style={getActiveStyle('/profile')}>
              Profile
            </a>

            <div style={{
              height: '1px',
              background: colors.border,
              margin: '20px 0'
            }} />

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 16px',
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Theme
              </span>
              <ThemePicker layout="horizontal" />
            </div>

            <button onClick={handleSignOut} style={menuItemStyle}>
              Sign Out
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
