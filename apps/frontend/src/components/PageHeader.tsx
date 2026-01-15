import { ReactNode } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

interface PageHeaderProps {
  showNav?: boolean
  searchComponent?: ReactNode
}

export function PageHeader({ showNav = true, searchComponent }: PageHeaderProps) {
  const { user, signOut } = useAuth()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const navItems = [
    { label: 'Aspects', path: '/aspects' },
    { label: 'Profile', path: '/profile' }
  ]

  return (
    <header style={{
      height: '60px',
      background: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 30px',
      flexShrink: 0,
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
        <a
          href="/calendar"
          className="serif"
          style={{
            fontSize: '26px',
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
          <nav style={{ display: 'flex', gap: '8px' }}>
            {navItems.map(item => {
              const isActive = window.location.pathname === item.path
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className="serif"
                  style={{
                    padding: '8px 16px',
                    fontSize: '16px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span style={{ fontSize: '13px', color: colors.textSecondary }}>{user?.email}</span>
        <button
          onClick={toggleDarkMode}
          style={{
            padding: '8px 12px',
            background: colors.bgHover,
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s'
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
        <button onClick={signOut} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
          Sign Out
        </button>
      </div>
    </header>
  )
}
