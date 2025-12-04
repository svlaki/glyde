{/* This file controls the agent interaction panel on the calendar page */}

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors, hexToRgba } from '../styles/colors'

interface Interaction {
  id: string
  question: string
  interaction_type: 'yes_no' | 'multiple_choice'
  options?: string[]
  priority: number
  category?: {
    id: string
    name: string
    color: string
  } | null
  metadata?: Record<string, any>
  created_at: string
  expires_at?: string
}

export interface AgentInteractionsProps {
  // No props needed - interactions are fetched independently
}

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export function AgentInteractions() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [textInputs, setTextInputs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [showCustomTimeInput, setShowCustomTimeInput] = useState<string | null>(null) // interaction ID showing custom time input
  const [customTimeInputs, setCustomTimeInputs] = useState<Record<string, string>>({}) // custom time values per interaction

  // Dismiss an interaction without sending a response
  const dismissInteraction = useCallback((interactionId: string) => {
    setInteractions(prev => prev.filter(i => i.id !== interactionId))
  }, [])

  // Fetch pending interactions
  const fetchInteractions = useCallback(async (showRefreshing = false) => {
    if (!user || !session) return

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
      setInteractions(data.interactions || [])
    } catch (err) {
      console.error('Error fetching interactions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load interactions')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user, session])

  // Initial fetch
  useEffect(() => {
    fetchInteractions()
  }, [fetchInteractions])

  // Respond to an interaction
  const handleRespond = async (interactionId: string, response: string) => {
    if (!user || !session || respondingTo) return

    setRespondingTo(interactionId)

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

      // Remove the interaction from the list
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
    } catch (err) {
      console.error('Error responding to interaction:', err)
      setError('Failed to submit response')
    } finally {
      setRespondingTo(null)
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
  const isResponding = respondingTo === interaction.id

  if (interaction.interaction_type === 'yes_no') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleRespond(interaction.id, 'yes')}
            disabled={isResponding}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: '500',
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
              fontSize: '13px',
              fontWeight: '500',
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
  }

  if (interaction.interaction_type === 'multiple_choice') {
    const isShowingCustomTime = showCustomTimeInput === interaction.id
    const customTimeValue = customTimeInputs[interaction.id] || ''

    if (isShowingCustomTime) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
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
              fontSize: '13px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.bgPrimary,
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
                fontSize: '13px',
                fontWeight: '500',
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
                fontSize: '13px',
                fontWeight: '500',
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
                fontSize: '13px',
                fontWeight: '400',
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
        <button
          onClick={() => dismissInteraction(interaction.id)}
          disabled={isResponding}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '400',
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
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={() => handleRespond(interaction.id, 'acknowledged')}
        disabled={isResponding}
        style={{
          flex: 1,
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: '500',
          border: 'none',
          borderRadius: '6px',
          cursor: isResponding ? 'not-allowed' : 'pointer',
          background: isDarkMode ? '#4ade80' : '#22c55e',
          color: '#fff',
          opacity: isResponding ? 0.6 : 1,
          transition: 'opacity 0.15s'
        }}
      >
        Got it
      </button>
      <button
        onClick={() => dismissInteraction(interaction.id)}
        disabled={isResponding}
        style={{
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: '500',
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
      background: colors.bgPrimary,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: 0,
          color: colors.textPrimary,
          letterSpacing: '0.02em'
        }}>
          Interactions
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {interactions.length > 0 && (
            <span style={{
              fontSize: '12px',
              color: colors.textTertiary,
              background: colors.bgTertiary,
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {interactions.length}
            </span>
          )}
          <button
            onClick={handleGenerateInteractions}
            disabled={isRefreshing}
            title="Generate new interactions"
            style={{
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => {
              if (!isRefreshing) e.currentTarget.style.background = colors.bgTertiary
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
              }}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          margin: '0 16px 12px 16px',
          padding: '10px 12px',
          background: hexToRgba(isDarkMode ? '#ef4444' : '#dc2626', 0.1),
          border: `1px solid ${hexToRgba(isDarkMode ? '#ef4444' : '#dc2626', 0.3)}`,
          borderRadius: '8px',
          fontSize: '13px',
          color: isDarkMode ? '#fca5a5' : '#dc2626'
        }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
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
            <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
              No interactions right now
            </p>
            <p style={{ fontSize: '12px', margin: 0 }}>
              Click refresh to generate insights
            </p>
          </div>
        ) : (
          // Interaction cards
          interactions.map((interaction) => (
            <div
              key={interaction.id}
              style={{
                background: colors.bgSecondary,
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                borderLeft: `3px solid ${interaction.category?.color || getPriorityColor(interaction.priority)}`,
                position: 'relative',
                transition: 'box-shadow 0.15s'
              }}
            >
              {/* Header row with category and dismiss */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {interaction.category && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '500',
                      color: interaction.category.color,
                      background: hexToRgba(interaction.category.color, 0.15),
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {interaction.category.name}
                    </span>
                  )}
                  <span style={{
                    fontSize: '11px',
                    color: colors.textTertiary
                  }}>
                    {formatTimeAgo(interaction.created_at)}
                  </span>
                </div>
              </div>

              {/* Question */}
              <p style={{
                fontSize: '14px',
                lineHeight: '1.5',
                margin: '0 0 12px 0',
                color: colors.textPrimary,
                fontFamily: 'Georgia, "Times New Roman", serif'
              }}>
                {interaction.question}
              </p>

              {/* Response options */}
              {renderResponseOptions(interaction)}

              {/* Loading overlay */}
              {respondingTo === interaction.id && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: hexToRgba(colors.bgSecondary, 0.7),
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: colors.textSecondary,
                      animation: 'bounce 1.4s infinite ease-in-out both',
                      animationDelay: '-0.32s'
                    }} />
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: colors.textSecondary,
                      animation: 'bounce 1.4s infinite ease-in-out both',
                      animationDelay: '-0.16s'
                    }} />
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: colors.textSecondary,
                      animation: 'bounce 1.4s infinite ease-in-out both'
                    }} />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1.0);
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
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
