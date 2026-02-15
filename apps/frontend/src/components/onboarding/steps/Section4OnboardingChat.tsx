import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../../lib/themeContext'
import { getColors } from '../../../styles/colors'
import { usePlatform } from '../../../hooks/usePlatform'
import { ChatBot } from '../../ChatBot'
import type { ChatBotHandle } from '../../ChatBot'

interface Section4OnboardingChatProps {
  onComplete: () => void
}

export function Section4OnboardingChat({ onComplete }: Section4OnboardingChatProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { isMobile } = usePlatform()
  const chatRef = useRef<ChatBotHandle>(null)
  const [showContinue, setShowContinue] = useState(false)

  // Show continue button after a delay (30s timeout or when bot responds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContinue(true)
    }, 30000)
    return () => clearTimeout(timer)
  }, [])

  // Also show continue button more quickly - poll chatRef for first response
  useEffect(() => {
    if (showContinue) return
    const interval = setInterval(() => {
      // Once the bot has finished its first response, show continue
      if (chatRef.current && !chatRef.current.isLoading) {
        // Give the bot a moment to finish
        setTimeout(() => setShowContinue(true), 2000)
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [showContinue])

  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: colors.bgPrimary,
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '16px 20px' : '20px 32px',
        paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 16px)' : '20px',
        borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: '4px',
        }}>
          Let's personalize your experience
        </h2>
        <p style={{
          fontSize: '14px',
          color: colors.textSecondary,
        }}>
          Chat with your assistant to refine your aspects and goals.
        </p>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <ChatBot
          ref={chatRef}
          hideHeader
          compact
          currentPageOverride="onboarding-enrichment"
          autoSendMessage="I just finished setting up my Glyde account. Help me personalize my aspects and goals."
        />
      </div>

      {/* Footer with Continue/Skip */}
      <div style={{
        padding: isMobile ? '12px 20px' : '16px 32px',
        paddingBottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 12px)' : '16px',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onComplete}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: colors.textTertiary,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Skip
        </button>

        {showContinue && (
          <button
            type="button"
            onClick={onComplete}
            style={{
              padding: '12px 28px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Continue to Calendar
          </button>
        )}
      </div>
    </div>
  )
}
