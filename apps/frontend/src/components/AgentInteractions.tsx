{/* This file controls the agent interaction panel on the calendar page */}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { trackEvent } from '../lib/analytics'
import { useTheme } from '../lib/themeContext'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontFamily, fontSize, fontWeight, lineHeight } from '../styles/typography'
import { RefreshButton } from './ui/IconButtons'

interface Interaction {
  id: string
  question: string
  interaction_type: 'yes_no' | 'choice' | 'multiple_choice' | 'text' | 'rating' | 'time_suggestion'
  options?: string[]
  priority: number
  aspect?: {
    id: string
    name: string
    color: string
  } | null
  metadata?: Record<string, any>
  created_at: string
  expires_at?: string
}

export interface AgentInteractionsProps {
  hideHeader?: boolean
  onChatReply?: (message: string) => void
}

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'
const MAX_PENDING_INTERACTIONS = 5
const AUTO_GENERATE_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function AgentInteractions({ hideHeader = false, onChatReply }: AgentInteractionsProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false) // Desktop-scaled mobile fonts

  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [respondingTo, setRespondingTo] = useState<Set<string>>(new Set())
  const [textInputs, setTextInputs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [showCustomTimeInput, setShowCustomTimeInput] = useState<string | null>(null) // interaction ID showing custom time input
  const [customTimeInputs, setCustomTimeInputs] = useState<Record<string, string>>({}) // custom time values per interaction
  const [showChatReply, setShowChatReply] = useState<string | null>(null) // interaction ID showing chat reply input
  const [chatReplyInputs, setChatReplyInputs] = useState<Record<string, string>>({}) // chat reply text per interaction

  // Track current pending count for auto-generation cap check
  const interactionsRef = useRef(interactions)
  useEffect(() => {
    interactionsRef.current = interactions
  }, [interactions])

  // Guard against concurrent auto-generation requests
  const isGeneratingRef = useRef(false)

  // Dismiss an interaction - remove from UI and mark as dismissed in backend
  const dismissInteraction = useCallback(async (interactionId: string) => {
    setInteractions(prev => prev.filter(i => i.id !== interactionId))
    trackEvent('interaction_dismissed', 'agent', { interaction_id: interactionId })

    if (!session) return
    try {
      await fetch(`${AGENT_SERVICE_URL}/api/interactions/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          interaction_id: interactionId,
          response: 'dismissed'
        })
      })
    } catch (err) {
      // Silently fail - interaction is already removed from UI
    }
  }, [session])

  // Fetch pending interactions, returns the count fetched
  const fetchInteractions = useCallback(async (showRefreshing = false): Promise<number> => {
    if (!user || !session) return 0

    if (showRefreshing) {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const response = await fetch(`${AGENT_SERVICE_URL}/api/interactions/pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch interactions: ${response.status}`)
      }

      const data = await response.json()
      const fetched = data.interactions || []
      setInteractions(fetched)
      return fetched.length
    } catch (err) {
      console.error('Error fetching interactions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load interactions')
      return 0
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user, session])

  // Auto-generate interactions if under the pending cap
  const generateIfNeeded = useCallback(async () => {
    if (!user || !session) return
    if (interactionsRef.current.length >= MAX_PENDING_INTERACTIONS) return
    if (isGeneratingRef.current) return

    isGeneratingRef.current = true
    setIsRefreshing(true)
    setError(null)

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          context: {
            userId: user.id,
            sessionId: `interactions-${Date.now()}`,
            timezone: timezone,
            conversationHistory: []
          },
          message: 'Generate 2-3 proactive suggestions based on my calendar, tasks, and goals. Create interactive prompts that I can respond to.',
          targetAgent: 'interaction',
          isInternal: true
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to generate interactions: ${response.status}`)
      }

      await fetchInteractions()
    } catch (err) {
      console.error('Error auto-generating interactions:', err)
    } finally {
      isGeneratingRef.current = false
      setIsRefreshing(false)
    }
  }, [user, session, fetchInteractions])

  // Initial fetch, then auto-generate if under the pending cap
  useEffect(() => {
    let cancelled = false

    async function initAndAutoGenerate() {
      const pendingCount = await fetchInteractions()
      if (cancelled) return

      // Auto-generate if under the cap
      if (pendingCount < MAX_PENDING_INTERACTIONS) {
        await generateIfNeeded()
      }
    }

    initAndAutoGenerate()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInteractions])

  // Auto-generate new interactions every 5 minutes if under the cap
  useEffect(() => {
    if (!user || !session) return

    const interval = setInterval(() => {
      generateIfNeeded()
    }, AUTO_GENERATE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [user, session, generateIfNeeded])

  // Respond to an interaction (optimistic UI - remove immediately)
  const handleRespond = async (interactionId: string, response: string) => {
    if (!user || !session || respondingTo.has(interactionId)) return

    // Prevent double-submit
    setRespondingTo(prev => new Set([...prev, interactionId]))

    // Optimistically remove the interaction immediately
    const removedInteraction = interactions.find(i => i.id === interactionId)
    setInteractions(prev => prev.filter(i => i.id !== interactionId))

    // Clear any inputs for this interaction
    setTextInputs(prev => {
      const updated = { ...prev }
      delete updated[interactionId]
      return updated
    })
    setCustomTimeInputs(prev => {
      const updated = { ...prev }
      delete updated[interactionId]
      return updated
    })
    setShowCustomTimeInput(null)

    // Fire API call in the background
    try {
      const res = await fetch(`${AGENT_SERVICE_URL}/api/interactions/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          interaction_id: interactionId,
          response: response
        })
      })

      if (!res.ok) {
        throw new Error(`Failed to respond: ${res.status}`)
      }

      const responseData = await res.json()

      trackEvent('interaction_responded', 'agent', { interaction_id: interactionId, response })

      // If there's a follow-up interaction, refetch to show it
      if (responseData.hasFollowUp) {
        console.log('[AgentInteractions] Follow-up created, refetching interactions')
        await fetchInteractions()
      }
    } catch (err) {
      console.error('Error responding to interaction:', err)
      // Restore the interaction on failure so user can retry
      if (removedInteraction) {
        setInteractions(prev => [...prev, removedInteraction])
      }
      setError('Failed to submit response')
    } finally {
      setRespondingTo(prev => {
        const next = new Set(prev)
        next.delete(interactionId)
        return next
      })
    }
  }

  // Handle "Other time" button click - show input instead of responding
  const handleOtherTimeClick = (interactionId: string) => {
    setShowCustomTimeInput(interactionId)
  }

  // Handle custom time submission
  const handleCustomTimeSubmit = (interactionId: string) => {
    const customTime = customTimeInputs[interactionId]?.trim()
    if (customTime) {
      // Send as "custom_time:<user input>" so backend can parse it
      handleRespond(interactionId, `custom_time:${customTime}`)
    }
  }

  // Handle chat reply submission - sends message to ChatBot with interaction context
  const handleChatReplySubmit = (interaction: Interaction) => {
    const chatText = chatReplyInputs[interaction.id]?.trim()
    if (!chatText || !onChatReply) return

    const contextMessage = `Regarding your suggestion: "${interaction.question}"\n\n${chatText}`

    // Dismiss the interaction
    dismissInteraction(interaction.id)

    // Send to ChatBot
    onChatReply(contextMessage)

    // Clean up state
    setChatReplyInputs(prev => {
      const updated = { ...prev }
      delete updated[interaction.id]
      return updated
    })
    setShowChatReply(null)
  }

  // Trigger proactive agent to generate new interactions
  const handleGenerateInteractions = async () => {
    if (!user || !session) return

    setIsRefreshing(true)
    setError(null)

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          context: {
            userId: user.id,
            sessionId: `interactions-${Date.now()}`,
            timezone: timezone,
            conversationHistory: []
          },
          message: 'Generate 2-3 proactive suggestions based on my calendar, tasks, and goals. Create interactive prompts that I can respond to.',
          targetAgent: 'interaction',
          isInternal: true
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to generate interactions: ${response.status}`)
      }

      // Refetch interactions after generation
      await fetchInteractions()
    } catch (err) {
      console.error('Error generating interactions:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate interactions')
      setIsRefreshing(false)
    }
  }

  // Render response options based on interaction type
  const renderResponseOptions = (interaction: Interaction) => {
    const isResponding = respondingTo.has(interaction.id)

    switch (interaction.interaction_type) {
      case 'yes_no':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRespond(interaction.id, 'yes')}
                disabled={isResponding}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isResponding ? 'not-allowed' : 'pointer',
                  background: isDarkMode ? '#4ade80' : '#22c55e',
                  color: '#fff',
                  opacity: isResponding ? 0.6 : 1,
                  transition: 'opacity 0.15s, transform 0.1s'
                }}
                onMouseEnter={(e) => {
                  if (!isResponding) e.currentTarget.style.opacity = '0.9'
                }}
                onMouseLeave={(e) => {
                  if (!isResponding) e.currentTarget.style.opacity = '1'
                }}
              >
                Yes
              </button>
              <button
                onClick={() => handleRespond(interaction.id, 'dismissed')}
                disabled={isResponding}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  cursor: isResponding ? 'not-allowed' : 'pointer',
                  background: colors.bgTertiary,
                  color: colors.textPrimary,
                  opacity: isResponding ? 0.6 : 1,
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isResponding) e.currentTarget.style.background = colors.bgHover
                }}
                onMouseLeave={(e) => {
                  if (!isResponding) e.currentTarget.style.background = colors.bgTertiary
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )

      case 'choice':
      case 'multiple_choice':
        const isShowingCustomTime = showCustomTimeInput === interaction.id
        const customTimeValue = customTimeInputs[interaction.id] || ''

        // If showing custom time input for this interaction
        if (isShowingCustomTime) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
                Enter your preferred time (e.g., "tomorrow at 3pm", "Friday 10am"):
              </div>
              <input
                type="text"
                value={customTimeValue}
                onChange={(e) => setCustomTimeInputs(prev => ({ ...prev, [interaction.id]: e.target.value }))}
                placeholder="e.g., tomorrow at 3pm"
                disabled={isResponding}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customTimeValue.trim()) {
                    handleCustomTimeSubmit(interaction.id)
                  } else if (e.key === 'Escape') {
                    setShowCustomTimeInput(null)
                  }
                }}
                style={{
                  padding: '10px 12px',
                  fontSize: fontSize.sm,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  background: colors.bgSecondary,
                  color: colors.textPrimary,
                  outline: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleCustomTimeSubmit(interaction.id)}
                  disabled={isResponding || !customTimeValue.trim()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (isResponding || !customTimeValue.trim()) ? 'not-allowed' : 'pointer',
                    background: (isResponding || !customTimeValue.trim())
                      ? colors.bgTertiary
                      : (isDarkMode ? '#4ade80' : '#22c55e'),
                    color: (isResponding || !customTimeValue.trim())
                      ? colors.textTertiary
                      : '#fff',
                    opacity: isResponding ? 0.6 : 1
                  }}
                >
                  Schedule
                </button>
                <button
                  onClick={() => setShowCustomTimeInput(null)}
                  disabled={isResponding}
                  style={{
                    padding: '8px 12px',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    cursor: isResponding ? 'not-allowed' : 'pointer',
                    background: colors.bgTertiary,
                    color: colors.textPrimary
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )
        }

        // Normal multiple choice rendering
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(interaction.options || []).map((option, idx) => {
              const isOtherTime = option.toLowerCase() === 'other time'

              return (
                <button
                  key={idx}
                  onClick={() => isOtherTime ? handleOtherTimeClick(interaction.id) : handleRespond(interaction.id, option)}
                  disabled={isResponding}
                  style={{
                    padding: '8px 12px',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.normal,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    cursor: isResponding ? 'not-allowed' : 'pointer',
                    background: colors.bgTertiary,
                    color: colors.textPrimary,
                    textAlign: 'left',
                    opacity: isResponding ? 0.6 : 1,
                    transition: 'background 0.15s, border-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isResponding) {
                      e.currentTarget.style.background = colors.bgHover
                      e.currentTarget.style.borderColor = colors.textTertiary
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isResponding) {
                      e.currentTarget.style.background = colors.bgTertiary
                      e.currentTarget.style.borderColor = colors.border
                    }
                  }}
                >
                  {option}
                </button>
              )
            })}
            {/* Dismiss button for choice/multiple_choice */}
            <button
              onClick={() => dismissInteraction(interaction.id)}
              disabled={isResponding}
              style={{
                padding: '8px 12px',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.normal,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: isResponding ? 'not-allowed' : 'pointer',
                background: colors.bgTertiary,
                color: colors.textTertiary,
                textAlign: 'center',
                opacity: isResponding ? 0.6 : 1,
                transition: 'background 0.15s, border-color 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isResponding) {
                  e.currentTarget.style.background = hexToRgba(colors.textTertiary, 0.1)
                }
              }}
              onMouseLeave={(e) => {
                if (!isResponding) {
                  e.currentTarget.style.background = colors.bgTertiary
                }
              }}
            >
              Dismiss
            </button>
          </div>
        )

      case 'text':
        const textValue = textInputs[interaction.id] || ''
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              value={textValue}
              onChange={(e) => setTextInputs(prev => ({ ...prev, [interaction.id]: e.target.value }))}
              placeholder="Type your response..."
              disabled={isResponding}
              style={{
                padding: '10px 12px',
                fontSize: fontSize.sm,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                background: colors.bgSecondary,
                color: colors.textPrimary,
                resize: 'none',
                minHeight: '60px',
                fontFamily: 'inherit',
                lineHeight: lineHeight.tight
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRespond(interaction.id, textValue)}
                disabled={isResponding || !textValue.trim()}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (isResponding || !textValue.trim()) ? 'not-allowed' : 'pointer',
                  background: (isResponding || !textValue.trim())
                    ? colors.bgTertiary
                    : (isDarkMode ? '#f0f0f0' : '#000'),
                  color: (isResponding || !textValue.trim())
                    ? colors.textTertiary
                    : (isDarkMode ? '#000' : '#fff'),
                  opacity: isResponding ? 0.6 : 1,
                  transition: 'opacity 0.15s'
                }}
              >
                Submit
              </button>
              <button
                onClick={() => dismissInteraction(interaction.id)}
                disabled={isResponding}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  cursor: isResponding ? 'not-allowed' : 'pointer',
                  background: colors.bgTertiary,
                  color: colors.textTertiary,
                  opacity: isResponding ? 0.6 : 1,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isResponding) {
                    e.currentTarget.style.background = hexToRgba(colors.textTertiary, 0.1)
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isResponding) {
                    e.currentTarget.style.background = colors.bgTertiary
                  }
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )

      case 'rating':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleRespond(interaction.id, rating.toString())}
                  disabled={isResponding}
                  style={{
                    width: '32px',
                    height: '32px',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    cursor: isResponding ? 'not-allowed' : 'pointer',
                    background: colors.bgTertiary,
                    color: colors.textPrimary,
                    opacity: isResponding ? 0.6 : 1,
                    transition: 'background 0.15s, transform 0.1s',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isResponding) {
                      e.currentTarget.style.background = isDarkMode ? '#4ade80' : '#22c55e'
                      e.currentTarget.style.color = '#fff'
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isResponding) {
                      e.currentTarget.style.background = colors.bgTertiary
                      e.currentTarget.style.color = colors.textPrimary
                      e.currentTarget.style.transform = 'scale(1)'
                    }
                  }}
                >
                  {rating}
                </button>
              ))}
            </div>
            {/* Dismiss button for rating */}
            <button
              onClick={() => dismissInteraction(interaction.id)}
              disabled={isResponding}
              style={{
                padding: '8px 12px',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.normal,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: isResponding ? 'not-allowed' : 'pointer',
                background: colors.bgTertiary,
                color: colors.textTertiary,
                opacity: isResponding ? 0.6 : 1,
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isResponding) {
                  e.currentTarget.style.background = hexToRgba(colors.textTertiary, 0.1)
                }
              }}
              onMouseLeave={(e) => {
                if (!isResponding) {
                  e.currentTarget.style.background = colors.bgTertiary
                }
              }}
            >
              Dismiss
            </button>
          </div>
        )

      case 'time_suggestion':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRespond(interaction.id, 'accept')}
                disabled={isResponding}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isResponding ? 'not-allowed' : 'pointer',
                  background: isDarkMode ? '#4ade80' : '#22c55e',
                  color: '#fff',
                  opacity: isResponding ? 0.6 : 1,
                  transition: 'opacity 0.15s'
                }}
              >
                Accept
              </button>
              <button
                onClick={() => handleRespond(interaction.id, 'reschedule')}
                disabled={isResponding}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  cursor: isResponding ? 'not-allowed' : 'pointer',
                  background: colors.bgTertiary,
                  color: colors.textPrimary,
                  opacity: isResponding ? 0.6 : 1,
                  transition: 'opacity 0.15s'
                }}
              >
                Suggest Different
              </button>
            </div>
            {/* Dismiss button for time_suggestion */}
            <button
              onClick={() => dismissInteraction(interaction.id)}
              disabled={isResponding}
              style={{
                padding: '8px 12px',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.normal,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: isResponding ? 'not-allowed' : 'pointer',
                background: colors.bgTertiary,
                color: colors.textTertiary,
                opacity: isResponding ? 0.6 : 1,
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => {
                if (!isResponding) {
                  e.currentTarget.style.background = hexToRgba(colors.textTertiary, 0.1)
                }
              }}
              onMouseLeave={(e) => {
                if (!isResponding) {
                  e.currentTarget.style.background = colors.bgTertiary
                }
              }}
            >
              Dismiss
            </button>
          </div>
        )

      default:
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleRespond(interaction.id, 'acknowledged')}
              disabled={isResponding}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                border: 'none',
                borderRadius: '6px',
                cursor: isResponding ? 'not-allowed' : 'pointer',
                background: isDarkMode ? '#f0f0f0' : '#000',
                color: isDarkMode ? '#000' : '#fff',
                opacity: isResponding ? 0.6 : 1,
                transition: 'opacity 0.15s'
              }}
            >
              Got it
            </button>
          </div>
        )
    }
  }

  // Get priority indicator color
  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return isDarkMode ? '#ef4444' : '#dc2626' // High priority - red
    if (priority >= 5) return isDarkMode ? '#f59e0b' : '#d97706' // Medium priority - amber
    return isDarkMode ? '#6b7280' : '#9ca3af' // Low priority - gray
  }

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: colors.bgSecondary,
      overflow: 'hidden'
    }}>
      {/* Header - Mobile-style */}
      {!hideHeader && (
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgSecondary
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{
              ...typography.headingLg,
              fontWeight: fontWeight.bold,
              margin: 0,
              color: colors.textPrimary
            }}>
              Interactions
            </h3>
            {interactions.length > 0 && (
              <span style={{
                ...typography.labelMd,
                color: colors.textTertiary
              }}>
                {interactions.length} pending
              </span>
            )}
          </div>
          <RefreshButton
            onClick={handleGenerateInteractions}
            disabled={isRefreshing}
            title="Generate new interactions"
          />
        </div>
      )}

      {/* Compact header when main header is hidden */}
      {hideHeader && (
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <span style={{
            fontSize: fontSize.sm,
            color: colors.textSecondary
          }}>
            {interactions.length} pending
          </span>
          <RefreshButton
            onClick={handleGenerateInteractions}
            disabled={isRefreshing}
            title="Generate new interactions"
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          margin: '0 clamp(8px, 2vw, 16px) clamp(8px, 1.5vh, 12px)',
          padding: 'clamp(8px, 1.5vh, 10px) clamp(8px, 2vw, 12px)',
          background: hexToRgba(isDarkMode ? '#ef4444' : '#dc2626', 0.1),
          border: `1px solid ${hexToRgba(isDarkMode ? '#ef4444' : '#dc2626', 0.3)}`,
          borderRadius: '8px',
          fontSize: fontSize.sm,
          color: isDarkMode ? '#fca5a5' : '#dc2626'
        }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px clamp(8px, 2vw, 16px) clamp(10px, 2vh, 14px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {isLoading ? (
          // Loading state
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '8px 0'
          }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: colors.bgSecondary,
                  padding: '14px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`
                }}
              >
                <div style={{
                  height: '14px',
                  width: '80%',
                  background: colors.bgTertiary,
                  borderRadius: '4px',
                  marginBottom: '12px',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                  height: '32px',
                  width: '100%',
                  background: colors.bgTertiary,
                  borderRadius: '6px',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
              </div>
            ))}
          </div>
        ) : interactions.length === 0 ? (
          // Empty state
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: colors.textTertiary
          }}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 12px auto', opacity: 0.5 }}
            >
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p style={{ fontSize: fontSize.base, margin: '0 0 4px 0' }}>
              No interactions right now
            </p>
            <p style={{ fontSize: fontSize.xs, margin: 0 }}>
              Click refresh to generate insights
            </p>
          </div>
        ) : (
          // Interaction cards
          interactions.map((interaction) => {
            const cardColor = interaction.aspect?.color || getPriorityColor(interaction.priority)
            return (
            <div
              key={interaction.id}
              style={{
                background: hexToRgba(cardColor, 0.12),
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                borderLeft: `3px solid ${cardColor}`,
                position: 'relative',
                transition: 'box-shadow 0.15s'
              }}
            >
              {/* Header row with category and dismiss */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {interaction.aspect && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: fontWeight.medium,
                      color: interaction.aspect.color,
                      background: hexToRgba(interaction.aspect.color, 0.15),
                      padding: '1px 6px',
                      borderRadius: '3px'
                    }}>
                      {interaction.aspect.name}
                    </span>
                  )}
                  <span style={{
                    fontSize: '10px',
                    color: colors.textTertiary
                  }}>
                    {formatTimeAgo(interaction.created_at)}
                  </span>
                </div>
              </div>

              {/* Question */}
              <p style={{
                fontSize: fontSize.sm,
                lineHeight: lineHeight.normal,
                margin: '0 0 8px 0',
                color: colors.textPrimary,
                fontFamily: fontFamily.serif
              }}>
                {interaction.question}
              </p>

              {/* Response options */}
              {renderResponseOptions(interaction)}

              {/* Chat reply section */}
              {onChatReply && (
                showChatReply === interaction.id ? (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'flex-end'
                    }}>
                      <input
                        type="text"
                        value={chatReplyInputs[interaction.id] || ''}
                        onChange={(e) => setChatReplyInputs(prev => ({ ...prev, [interaction.id]: e.target.value }))}
                        placeholder="Type a reply..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (chatReplyInputs[interaction.id] || '').trim()) {
                            handleChatReplySubmit(interaction)
                          } else if (e.key === 'Escape') {
                            setShowChatReply(null)
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          fontSize: fontSize.sm,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          background: colors.bgSecondary,
                          color: colors.textPrimary,
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                      <button
                        onClick={() => handleChatReplySubmit(interaction)}
                        disabled={!(chatReplyInputs[interaction.id] || '').trim()}
                        style={{
                          padding: '7px 10px',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: (chatReplyInputs[interaction.id] || '').trim() ? 'pointer' : 'not-allowed',
                          background: (chatReplyInputs[interaction.id] || '').trim()
                            ? (isDarkMode ? '#f0f0f0' : '#000')
                            : colors.bgTertiary,
                          color: (chatReplyInputs[interaction.id] || '').trim()
                            ? (isDarkMode ? '#000' : '#fff')
                            : colors.textTertiary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Send to chat"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 2L11 13" />
                          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowChatReply(null)}
                        style={{
                          padding: '7px 8px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: colors.bgTertiary,
                          color: colors.textTertiary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: fontSize.xs
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowChatReply(interaction.id)}
                    style={{
                      marginTop: '6px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: fontWeight.medium,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: 'transparent',
                      color: colors.textTertiary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = colors.textSecondary }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = colors.textTertiary }}
                    title="Reply with a message"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Reply
                  </button>
                )
              )}

            </div>
          )})
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}
