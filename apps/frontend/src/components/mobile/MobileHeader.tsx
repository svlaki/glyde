import { useState } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { mobileHeaderStyles } from '../../styles/mobileStyles'
import { MobileMenu } from './MobileMenu'

interface MobileHeaderProps {
  title: string
  onBack?: () => void
  actions?: React.ReactNode
  showMenu?: boolean
}

export function MobileHeader({ title, onBack, actions, showMenu = false }: MobileHeaderProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
          <button
            onClick={() => setIsMenuOpen(true)}
            style={{
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
            }}
          >
            ☰
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            style={{
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
            }}
          >
            ←
          </button>
        )}
        <h1 style={{
          flex: 1,
          fontSize: mobileHeaderStyles.titleFontSize,
          fontWeight: mobileHeaderStyles.titleFontWeight,
          letterSpacing: mobileHeaderStyles.titleLetterSpacing,
          margin: 0,
          color: colors.textPrimary
        }}>
          {title}
        </h1>
        {actions}
      </header>

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  )
}
