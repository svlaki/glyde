import { useState } from 'react'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { mobileHeaderStyles } from '../../styles/mobileStyles'
import { MobileMenu } from './MobileMenu'
import { GlobalSearch } from '../GlobalSearch'

interface MobileHeaderProps {
  title: string
  onBack?: () => void
  actions?: React.ReactNode
  showMenu?: boolean
  showSearch?: boolean
}

export function MobileHeader({ title, onBack, actions, showMenu = false, showSearch = false }: MobileHeaderProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(true) // Mobile context
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const headerButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: colors.textPrimary,
    fontSize: mobileHeaderStyles.buttonFontSize,
    padding: mobileHeaderStyles.buttonPadding,
    cursor: 'pointer',
    minWidth: mobileHeaderStyles.buttonMinSize,
    minHeight: mobileHeaderStyles.buttonMinSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } as const

  return (
    <>
      <header style={{
        background: colors.bgSecondary,
        display: 'flex',
        alignItems: 'center',
        gap: mobileHeaderStyles.gap,
        padding: `0 ${mobileHeaderStyles.paddingX}`,
        paddingTop: mobileHeaderStyles.paddingTop,
        paddingBottom: mobileHeaderStyles.paddingBottom,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        {showMenu && (
          <button onClick={() => setIsMenuOpen(true)} style={headerButtonStyle}>
            ☰
          </button>
        )}
        {onBack && (
          <button onClick={onBack} style={headerButtonStyle}>
            ←
          </button>
        )}
        <h1 style={{
          flex: 1,
          ...typography.headingLg,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          margin: 0,
          color: colors.textPrimary
        }}>
          {title}
        </h1>
        {showSearch && (
          <button onClick={() => setIsSearchOpen(true)} style={headerButtonStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        )}
        {actions}
      </header>

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {isSearchOpen && (
        <GlobalSearch
          controlledOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </>
  )
}
