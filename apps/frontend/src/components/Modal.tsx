import { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  headerContent?: ReactNode
  children: ReactNode
  maxWidth?: string
  preventAutoFocus?: boolean
}

export function Modal({ isOpen, onClose, title, headerContent, children, maxWidth = '500px', preventAutoFocus = false }: ModalProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
          }}
        />
        <Dialog.Content
          onOpenAutoFocus={preventAutoFocus ? (e) => e.preventDefault() : undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(90vw, 100%)',
            maxWidth,
            maxHeight: '85vh',
            background: colors.bgPrimary,
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            boxShadow: isDarkMode
              ? '0 24px 48px rgba(0, 0, 0, 0.4)'
              : '0 24px 48px rgba(0, 0, 0, 0.15)'
          }}
        >
          {/* Header - Mobile-style */}
          {(title || headerContent) && (
            <div style={{
              padding: '16px 20px',
              borderBottom: title ? `1px solid ${colors.border}` : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              background: colors.bgPrimary
            }}>
              {headerContent ? (
                <Dialog.Title asChild>
                  <div style={{ width: '100%' }}>{headerContent}</div>
                </Dialog.Title>
              ) : (
                <Dialog.Title style={{
                  ...typography.headingLg,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  margin: 0
                }}>
                  {title}
                </Dialog.Title>
              )}
              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  padding: '8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: colors.textTertiary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgHover
                  e.currentTarget.style.color = colors.textSecondary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = colors.textTertiary
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Children (form content) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
