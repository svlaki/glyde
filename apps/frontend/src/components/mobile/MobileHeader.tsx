import { useState } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
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
        minHeight: '56px',
        background: colors.bgSecondary,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        paddingTop: 'max(env(safe-area-inset-top), 8px)',
        paddingBottom: '8px',
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
              fontSize: '24px',
              padding: '8px',
              marginRight: '8px',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
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
              fontSize: '24px',
              padding: '8px',
              marginRight: '8px',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
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
          fontSize: '18px',
          fontWeight: '600',
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
