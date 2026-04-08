import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from '../../../lib/themeContext'
import { getColors } from '../../../styles/colors'
import { usePlatform } from '../../../hooks/usePlatform'
import { useAuth } from '../../../lib/authContext'
import { ChatBot } from '../../ChatBot'
import type { ChatBotHandle } from '../../ChatBot'
import { clearChatSession } from '../../ChatBot'

interface Section4OnboardingChatProps {
  onComplete: () => void
  userName?: string
  occupation?: string
  aspects?: string[]
  goals?: string[]
}

/**
 * Build a context-rich auto-send message from onboarding form data.
 * Gives the agent a head start so it doesn't re-ask what the user already entered.
 */
function buildAutoSendMessage(
  userName?: string,
  occupation?: string,
  aspects?: string[],
  goals?: string[],
): string {
  const parts: string[] = []

  if (userName && occupation) {
    parts.push(`I'm ${userName}, ${occupation}.`)
  } else if (userName) {
    parts.push(`I'm ${userName}.`)
  }

  if (aspects && aspects.length > 0) {
    const listed = aspects.slice(0, 5).join(', ')
    parts.push(`I've set up aspects for ${listed}.`)
  }

  if (goals && goals.length > 0) {
    const listed = goals.slice(0, 3).join(', ')
    parts.push(`My goals are ${listed}.`)
  }

  parts.push("Let's dig in and fill in the details -- schedule, routines, anything I should have on my calendar.")

  return parts.join(' ')
}

export function Section4OnboardingChat({
  onComplete,
  userName,
  occupation,
  aspects,
  goals,
}: Section4OnboardingChatProps) {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const { isMobile } = usePlatform()
  const { user, session } = useAuth()
  const chatRef = useRef<ChatBotHandle>(null)
  const [showContinue, setShowContinue] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const autoMessage = buildAutoSendMessage(userName, occupation, aspects, goals)

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
      if (chatRef.current && !chatRef.current.isLoading) {
        setTimeout(() => setShowContinue(true), 2000)
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [showContinue])

  // Clear onboarding chat history and navigate to main app
  const handleTransition = useCallback(async () => {
    setIsTransitioning(true)
    try {
      if (user?.id && session?.access_token) {
        await clearChatSession(user.id, session.access_token)
      }
    } catch (error) {
      console.warn('[Section4] Failed to clear chat session:', error)
    }
    onComplete()
  }, [user, session, onComplete])

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
          targetAgent="onboarding"
          autoSendMessage={autoMessage}
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
          onClick={handleTransition}
          disabled={isTransitioning}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: colors.textTertiary,
            fontSize: '14px',
            cursor: isTransitioning ? 'wait' : 'pointer',
            opacity: isTransitioning ? 0.5 : 1,
          }}
        >
          Skip
        </button>

        {showContinue && (
          <button
            type="button"
            onClick={handleTransition}
            disabled={isTransitioning}
            style={{
              padding: '12px 28px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 500,
              cursor: isTransitioning ? 'wait' : 'pointer',
              opacity: isTransitioning ? 0.7 : 1,
            }}
          >
            {isTransitioning ? 'Loading...' : 'Continue to Calendar'}
          </button>
        )}
      </div>
    </div>
  )
}
