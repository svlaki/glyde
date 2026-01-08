import { ReactNode } from 'react'
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

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'clamp(8px, 2vw, 20px)'
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />

      {/* Modal Content */}
      <div style={{
        position: 'relative',
        width: 'min(90vw, 100%)',
        maxWidth,
        maxHeight: '85vh',
        background: colors.bgSecondary,
        borderRadius: 'clamp(8px, 2vw, 12px)',
        border: `1px solid ${colors.border}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: 'clamp(12px, 2.5vh, 20px) clamp(12px, 3vw, 20px)',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.textPrimary,
            margin: 0
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
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
        </div>

        {/* Children (form content) */}
        {children}
      </div>
    </div>
  )
}
