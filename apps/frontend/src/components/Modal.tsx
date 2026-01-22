import { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: string
}

export function Modal({ isOpen, onClose, title, children, maxWidth = '600px' }: ModalProps) {
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
          <div style={{
            padding: 'clamp(12px, 2.5vh, 20px) clamp(12px, 3vw, 20px)',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <Dialog.Title style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.textPrimary,
              margin: 0
            }}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </Dialog.Close>
          </div>

          {/* Children (form content) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
