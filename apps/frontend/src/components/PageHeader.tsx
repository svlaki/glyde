import { ReactNode, useState } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { ThemePicker } from './ui/ThemePicker'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { DesktopMenu } from './DesktopMenu'

interface PageHeaderProps {
  showNav?: boolean
  searchComponent?: ReactNode
}

export function PageHeader({ showNav = true, searchComponent }: PageHeaderProps) {
  const { preferredName, user } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const displayName = preferredName || user?.email?.split('@')[0] || 'there'
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Don't render on mobile - MobileHeader is used instead
  if (isMobile) {
    return null
  }

  return (
    <>
      <header style={{
        height: '56px',
        background: colors.bgSecondary,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        flexShrink: 0,
        gap: '16px'
      }}>
        {/* Left side: Menu button + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Hamburger menu button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textPrimary,
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            title="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Logo */}
          <a
            href="/calendar"
            className="serif"
            style={{
              ...typography.headingLg,
              fontWeight: 700,
              textDecoration: 'none',
              color: colors.textPrimary,
              cursor: 'pointer'
            }}
          >
            Glyde
          </a>
        </div>

        {/* Center: Search Component (if provided) */}
        {searchComponent && (
          <div style={{ flex: 1, maxWidth: '400px' }}>
            {searchComponent}
          </div>
        )}

        {/* Right side: greeting + dark mode toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            ...typography.bodySm,
            color: colors.textSecondary
          }}>
            Hello, {displayName}
          </span>
          <ThemePicker />
        </div>
      </header>

      {/* Desktop Menu Drawer */}
      <DesktopMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  )
}
