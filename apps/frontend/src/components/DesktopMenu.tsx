import { Drawer } from 'vaul'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { ThemePicker } from './ui/ThemePicker'
import { getTypography } from '../styles/typography'

interface DesktopMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function DesktopMenu({ isOpen, onClose }: DesktopMenuProps) {
  const { signOut, preferredName, user } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false) // Desktop context
  const displayName = preferredName || user?.email?.split('@')[0] || 'there'

  const handleSignOut = () => {
    onClose()
    signOut()
  }

  const menuItemStyle = {
    display: 'block',
    padding: '12px 20px',
    ...typography.bodyMd,
    color: colors.textPrimary,
    textDecoration: 'none',
    borderRadius: '8px',
    marginBottom: '4px',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'background 0.15s'
  }

  const getActiveStyle = (path: string) => ({
    ...menuItemStyle,
    background: window.location.pathname === path ? colors.bgHover : 'transparent',
    fontWeight: window.location.pathname === path ? 600 : 400
  })

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()} direction="left">
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
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
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
            boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)'
          }}
        >
          {/* Menu header */}
          <div style={{
            padding: '24px 20px',
            borderBottom: `1px solid ${colors.border}`
          }}>
            <Drawer.Title className="serif" style={{
              ...typography.displayLg,
              fontWeight: 700,
              margin: 0,
              color: colors.textPrimary
            }}>
              Glyde
            </Drawer.Title>
            <p style={{
              ...typography.bodyLg,
              color: colors.textSecondary,
              margin: '8px 0 0 0'
            }}>
              Hello, {displayName}
            </p>
          </div>

          {/* Menu items */}
          <nav style={{ flex: 1, padding: '16px 12px', overflow: 'auto' }}>
            <a
              href="/calendar"
              onClick={onClose}
              style={getActiveStyle('/calendar')}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/calendar') {
                  e.currentTarget.style.background = colors.bgHover
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/calendar') {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              Calendar
            </a>
            <a
              href="/notes"
              onClick={onClose}
              style={getActiveStyle('/notes')}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/notes') {
                  e.currentTarget.style.background = colors.bgHover
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/notes') {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              Notes
            </a>
            <a
              href="/aspects"
              onClick={onClose}
              style={getActiveStyle('/aspects')}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/aspects') {
                  e.currentTarget.style.background = colors.bgHover
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/aspects') {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              Aspects
            </a>
            <a
              href="/connections"
              onClick={onClose}
              style={getActiveStyle('/connections')}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/connections') {
                  e.currentTarget.style.background = colors.bgHover
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/connections') {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              Connections
            </a>
            <a
              href="/profile"
              onClick={onClose}
              style={getActiveStyle('/profile')}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/profile') {
                  e.currentTarget.style.background = colors.bgHover
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/profile') {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              Profile
            </a>

            <div style={{
              height: '1px',
              background: colors.border,
              margin: '16px 8px'
            }} />

            <div style={{ padding: '4px 8px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
                paddingLeft: '2px',
              }}>
                Theme
              </div>
              <ThemePicker inline onSelect={onClose} />
            </div>

            <button
              onClick={handleSignOut}
              style={menuItemStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Sign Out
            </button>
          </nav>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
