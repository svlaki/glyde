import { Drawer } from 'vaul'
import { useAuth } from '../../lib/authContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { signOut, preferredName, user } = useAuth()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const displayName = preferredName || user?.email?.split('@')[0] || 'there'

  const handleSignOut = () => {
    onClose()
    signOut()
  }

  const menuItemStyle = {
    display: 'block',
    padding: '12px 16px',
    fontSize: '16px',
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
              fontSize: '24px',
              fontWeight: '700',
              margin: 0,
              color: colors.textPrimary
            }}>
              Glyde
            </Drawer.Title>
            <p style={{
              fontSize: '14px',
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
            <a href="/plan" onClick={onClose} style={getActiveStyle('/plan')}>
              Plan
            </a>
            <a href="/aspects" onClick={onClose} style={getActiveStyle('/aspects')}>
              Aspects
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

            <button
              onClick={() => {
                toggleDarkMode()
                onClose()
              }}
              style={menuItemStyle}
            >
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>

            <button onClick={handleSignOut} style={menuItemStyle}>
              Sign Out
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
