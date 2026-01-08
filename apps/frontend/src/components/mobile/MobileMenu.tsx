import { useAuth } from '../../lib/authContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { signOut } = useAuth()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  if (!isOpen) return null

  const handleSignOut = () => {
    onClose()
    signOut()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999
        }}
      />

      {/* Menu drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '280px',
        background: colors.bgSecondary,
        zIndex: 1000,
        paddingTop: 'env(safe-area-inset-top)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Menu header */}
        <div style={{
          padding: '20px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h2 className="serif" style={{
            fontSize: '24px',
            fontWeight: '700',
            margin: 0,
            color: colors.textPrimary
          }}>
            Glyde
          </h2>
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, padding: '20px' }}>
          <a
            href="/calendar"
            onClick={onClose}
            style={{
              display: 'block',
              padding: '12px 16px',
              fontSize: '16px',
              color: colors.textPrimary,
              textDecoration: 'none',
              borderRadius: '8px',
              background: window.location.pathname === '/calendar' ? colors.bgHover : 'transparent',
              marginBottom: '8px'
            }}
          >
            Calendar
          </a>
          <a
            href="/aspects"
            onClick={onClose}
            style={{
              display: 'block',
              padding: '12px 16px',
              fontSize: '16px',
              color: colors.textPrimary,
              textDecoration: 'none',
              borderRadius: '8px',
              background: window.location.pathname === '/aspects' ? colors.bgHover : 'transparent',
              marginBottom: '8px'
            }}
          >
            Aspects
          </a>
          <a
            href="/profile"
            onClick={onClose}
            style={{
              display: 'block',
              padding: '12px 16px',
              fontSize: '16px',
              color: colors.textPrimary,
              textDecoration: 'none',
              borderRadius: '8px',
              background: window.location.pathname === '/profile' ? colors.bgHover : 'transparent',
              marginBottom: '8px'
            }}
          >
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
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              color: colors.textPrimary,
              textDecoration: 'none',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              marginBottom: '8px'
            }}
          >
            {isDarkMode ? '' : ''} {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              color: colors.textPrimary,
              textDecoration: 'none',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  )
}
