import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { ChatBot } from './ChatBot'
import type { ChatBotHandle } from './ChatBot'

interface FloatingChatProps {
  /** Override the page context sent to the agent */
  currentPageOverride?: string
}

export function FloatingChat({ currentPageOverride }: FloatingChatProps) {
  const { isDarkMode } = useTheme()
  const { theme } = useTheme()
  const colors = getColors(theme)
  const [isOpen, setIsOpen] = useState(false)
  const chatRef = useRef<ChatBotHandle>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    // Delay to avoid closing immediately on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  return (
    <>
      {/* Floating bubble button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: colors.accent,
            color: isDarkMode ? '#111' : '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            zIndex: 100,
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          title="Chat with Glyde"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '400px',
            height: '540px',
            borderRadius: '16px',
            overflow: 'hidden',
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: colors.textPrimary,
            }}>
              Chat
            </span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textTertiary,
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>

          {/* ChatBot */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatBot
              ref={chatRef}
              hideHeader
              compact
              currentPageOverride={currentPageOverride || 'notes'}
            />
          </div>
        </div>
      )}
    </>
  )
}
