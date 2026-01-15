import { ReactNode } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'

interface PageHeaderProps {
  showNav?: boolean
  searchComponent?: ReactNode
}

export function PageHeader({ showNav = true, searchComponent }: PageHeaderProps) {
  const { user, signOut } = useAuth()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  // Don't render on mobile - MobileHeader is used instead
  if (isMobile) {
    return null
  }

  const navItems = [
    { label: 'Aspects', path: '/aspects' },
    { label: 'Profile', path: '/profile' }
  ]

  return (
    <header style={{
      height: 'clamp(50px, 8vh, 60px)',
      background: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 clamp(15px, 4vw, 30px)',
      flexShrink: 0,
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px, 5vw, 40px)' }}>
        <a
          href="/calendar"
          className="serif"
          style={{
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: '700',
            margin: 0,
            textDecoration: 'none',
            color: colors.textPrimary,
            cursor: 'pointer'
          }}
        >
          Glyde
        </a>
        {showNav && (
          <nav style={{ display: 'flex', gap: 'clamp(4px, 1vw, 8px)' }}>
            {navItems.map(item => {
              const isActive = window.location.pathname === item.path
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className="serif"
                  style={{
                    padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 2.5vw, 16px)',
                    fontSize: 'clamp(14px, 3vw, 16px)',
                    fontWeight: '500',
                    color: colors.textPrimary,
                    textDecoration: 'none',
                    borderRadius: '6px',
                    background: isActive ? colors.bgHover : 'transparent',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = colors.bgHover
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
        )}
        {/* Search Component */}
        {searchComponent && (
          <div style={{ marginLeft: '20px' }}>
            {searchComponent}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 15px)' }}>
        <span style={{ fontSize: 'clamp(11px, 2vw, 13px)', color: colors.textSecondary, display: window.innerWidth < 600 ? 'none' : 'inline' }}>{user?.email}</span>
        <button
          onClick={toggleDarkMode}
          style={{
            padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)',
            background: colors.bgHover,
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: 'clamp(12px, 2.5vw, 14px)',
            transition: 'all 0.2s',
            minHeight: '36px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.bgTertiary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.bgHover
          }}
        >
          {isDarkMode ? 'Light' : 'Dark'}
        </button>
        <button onClick={signOut} className="btn btn-secondary" style={{ padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 2.5vw, 16px)', fontSize: 'clamp(12px, 2.5vw, 14px)', minHeight: '36px' }}>
          Sign Out
        </button>
      </div>
    </header>
  )
}
