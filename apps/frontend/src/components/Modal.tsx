import { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  headerContent?: ReactNode
  children: ReactNode
  maxWidth?: string
  preventAutoFocus?: boolean
}

export function Modal({ isOpen, onClose, title, headerContent, children, maxWidth = '600px', preventAutoFocus = false }: ModalProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
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
            background: colors.bgSecondary,
            borderRadius: 'clamp(8px, 2vw, 12px)',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001
          }}
        >
          {/* Header */}
          {(title || headerContent) && (
            <div style={{
              padding: 'clamp(12px, 2.5vh, 16px) clamp(12px, 3vw, 20px)',
              borderBottom: title ? `1px solid ${colors.border}` : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              {headerContent ? (
                <Dialog.Title asChild>
                  <div style={{ width: '100%' }}>{headerContent}</div>
                </Dialog.Title>
              ) : (
                <Dialog.Title style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: colors.textPrimary,
                  margin: 0
                }}>
                  {title}
                </Dialog.Title>
              )}
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
