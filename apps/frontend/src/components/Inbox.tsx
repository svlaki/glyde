import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontFamily, fontSize, fontWeight, lineHeight } from '../styles/typography'
import { RefreshButton } from './ui/IconButtons'
import { fetchInboxItems, acceptEventInvite, declineEventInvite, acceptAspectInvite, declineAspectInvite } from '../lib/inboxService'
import type { InboxItem } from '../lib/inboxService'
import { acceptFriendRequest, declineFriendRequest } from '../lib/friendshipService'

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export interface InboxProps {
  hideHeader?: boolean
  onChatReply?: (message: string) => void
}

export function Inbox({ hideHeader = false, onChatReply: _onChatReply }: InboxProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)

  const [items, setItems] = useState<InboxItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [textInputs, setTextInputs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async (showRefreshing = false) => {
    if (!session) return
    if (showRefreshing) setIsRefreshing(true)
    setError(null)

    try {
      const data = await fetchInboxItems(session.access_token)
      setItems(data)
    } catch (err) {
      console.error('Error fetching inbox:', err)
      setError('Failed to load inbox')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [session])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Mark an item as processing (disable buttons while in flight)
  const markProcessing = (id: string) => {
    setProcessingIds(prev => new Set([...prev, id]))
  }
  const unmarkProcessing = (id: string) => {
    setProcessingIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // --- Interaction handlers ---
  const handleInteractionRespond = async (interactionId: string, response: string) => {
    if (!session || processingIds.has(interactionId)) return
    markProcessing(interactionId)
    const removed = items.find(i => i.id === interactionId)
    removeItem(interactionId)

    try {
      const res = await fetch(`${AGENT_SERVICE_URL}/api/interactions/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ interaction_id: interactionId, response })
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      if (removed) setItems(prev => [...prev, removed])
      setError('Failed to submit response')
    } finally {
      unmarkProcessing(interactionId)
    }
  }

  const dismissInteraction = async (interactionId: string) => {
    removeItem(interactionId)
    if (!session) return
    try {
      await fetch(`${AGENT_SERVICE_URL}/api/interactions/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ interaction_id: interactionId, response: 'dismissed' })
      })
    } catch { /* silently fail */ }
  }

  // --- Event invite handlers ---
  const handleAcceptInvite = async (item: InboxItem) => {
    if (!session || !item.event_id || processingIds.has(item.id)) return
    markProcessing(item.id)
    removeItem(item.id)

    try {
      await acceptEventInvite(item.event_id, session.access_token)
    } catch {
      setItems(prev => [...prev, item])
      setError('Failed to accept invite')
    } finally {
      unmarkProcessing(item.id)
    }
  }

  const handleDeclineInvite = async (item: InboxItem) => {
    if (!session || !item.event_id || processingIds.has(item.id)) return
    markProcessing(item.id)
    removeItem(item.id)

    try {
      await declineEventInvite(item.event_id, session.access_token)
    } catch {
      setItems(prev => [...prev, item])
      setError('Failed to decline invite')
    } finally {
      unmarkProcessing(item.id)
    }
  }

  // --- Friend request handlers ---
  const handleAcceptFriend = async (item: InboxItem) => {
    if (!session || !item.friendship_id || processingIds.has(item.id)) return
    markProcessing(item.id)
    removeItem(item.id)

    try {
      await acceptFriendRequest(item.friendship_id, session.access_token)
    } catch {
      setItems(prev => [...prev, item])
      setError('Failed to accept friend request')
    } finally {
      unmarkProcessing(item.id)
    }
  }

  const handleDeclineFriend = async (item: InboxItem) => {
    if (!session || !item.friendship_id || processingIds.has(item.id)) return
    markProcessing(item.id)
    removeItem(item.id)

    try {
      await declineFriendRequest(item.friendship_id, false, session.access_token)
    } catch {
      setItems(prev => [...prev, item])
      setError('Failed to decline friend request')
    } finally {
      unmarkProcessing(item.id)
    }
  }

  const handleBlockFriend = async (item: InboxItem) => {
    if (!session || !item.friendship_id || processingIds.has(item.id)) return
    markProcessing(item.id)
    removeItem(item.id)

    try {
      await declineFriendRequest(item.friendship_id, true, session.access_token)
    } catch {
      setItems(prev => [...prev, item])
      setError('Failed to block user')
    } finally {
      unmarkProcessing(item.id)
    }
  }

  // --- Aspect invite handlers ---
  const handleAcceptAspect = async (item: InboxItem) => {
    if (!session || !item.aspect_id || processingIds.has(item.id)) return
    markProcessing(item.id)
    removeItem(item.id)

    try {
      await acceptAspectInvite(item.aspect_id, session.access_token)
    } catch {
      setItems(prev => [...prev, item])
      setError('Failed to accept aspect invite')
    } finally {
      unmarkProcessing(item.id)
    }
  }

  const handleDeclineAspect = async (item: InboxItem) => {
    if (!session || !item.aspect_id || processingIds.has(item.id)) return
    markProcessing(item.id)
    removeItem(item.id)

    try {
      await declineAspectInvite(item.aspect_id, session.access_token)
    } catch {
      setItems(prev => [...prev, item])
      setError('Failed to decline aspect invite')
    } finally {
      unmarkProcessing(item.id)
    }
  }

  // --- Refresh: generate new interactions ---
  const handleRefresh = async () => {
    if (!user || !session) return
    setIsRefreshing(true)
    setError(null)

    try {
      await fetch(`${AGENT_SERVICE_URL}/api/agent/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          context: {
            userId: user.id,
            sessionId: `inbox-${Date.now()}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            conversationHistory: []
          },
          message: 'Generate 1-2 significant proactive suggestions based on my goals and tasks. Focus on goal check-ins, reflections, or data cleanup — NOT scheduling.',
          targetAgent: 'interaction',
          isInternal: true
        })
      })
      await fetchItems()
    } catch (err) {
      console.error('Error refreshing inbox:', err)
      setError('Failed to refresh')
      setIsRefreshing(false)
    }
  }

  // --- Time formatting ---
  const formatTimeAgo = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const formatEventTime = (startTime: string) => {
    const d = new Date(startTime)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow = d.toDateString() === tomorrow.toDateString()

    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (isToday) return `Today at ${time}`
    if (isTomorrow) return `Tomorrow at ${time}`
    return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`
  }

  // --- Render interaction response options ---
  const renderInteractionOptions = (item: InboxItem) => {
    const isProcessing = processingIds.has(item.id)
    const interactionType = item.interaction_type

    if (interactionType === 'yes_no') {
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleInteractionRespond(item.id, 'yes')}
            disabled={isProcessing}
            style={{
              flex: 1, padding: '8px 12px', fontSize: fontSize.sm, fontWeight: fontWeight.medium,
              border: 'none', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer',
              background: isDarkMode ? '#4ade80' : '#22c55e', color: '#fff',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            Yes
          </button>
          <button
            onClick={() => dismissInteraction(item.id)}
            disabled={isProcessing}
            style={{
              flex: 1, padding: '8px 12px', fontSize: fontSize.sm, fontWeight: fontWeight.medium,
              border: `1px solid ${colors.border}`, borderRadius: '6px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              background: colors.bgTertiary, color: colors.textPrimary,
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            Dismiss
          </button>
        </div>
      )
    }

    if (interactionType === 'choice' || interactionType === 'multiple_choice') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(item.options || []).map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleInteractionRespond(item.id, option)}
              disabled={isProcessing}
              style={{
                padding: '8px 12px', fontSize: fontSize.sm, fontWeight: fontWeight.normal,
                border: `1px solid ${colors.border}`, borderRadius: '6px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                background: colors.bgTertiary, color: colors.textPrimary, textAlign: 'left',
                opacity: isProcessing ? 0.6 : 1, transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.background = colors.bgHover }}
              onMouseLeave={(e) => { if (!isProcessing) e.currentTarget.style.background = colors.bgTertiary }}
            >
              {option}
            </button>
          ))}
          <button
            onClick={() => dismissInteraction(item.id)}
            disabled={isProcessing}
            style={{
              padding: '8px 12px', fontSize: fontSize.sm, border: `1px solid ${colors.border}`,
              borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer',
              background: colors.bgTertiary, color: colors.textTertiary, textAlign: 'center',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            Dismiss
          </button>
        </div>
      )
    }

    if (interactionType === 'text') {
      const textValue = textInputs[item.id] || ''
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            value={textValue}
            onChange={(e) => setTextInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
            placeholder="Type your response..."
            disabled={isProcessing}
            style={{
              padding: '10px 12px', fontSize: fontSize.sm, border: `1px solid ${colors.border}`,
              borderRadius: '6px', background: colors.bgSecondary, color: colors.textPrimary,
              resize: 'none', minHeight: '60px', fontFamily: 'inherit', lineHeight: lineHeight.tight
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleInteractionRespond(item.id, textValue)}
              disabled={isProcessing || !textValue.trim()}
              style={{
                flex: 1, padding: '8px 12px', fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                border: 'none', borderRadius: '6px',
                cursor: (isProcessing || !textValue.trim()) ? 'not-allowed' : 'pointer',
                background: (isProcessing || !textValue.trim()) ? colors.bgTertiary : (isDarkMode ? '#f0f0f0' : '#000'),
                color: (isProcessing || !textValue.trim()) ? colors.textTertiary : (isDarkMode ? '#000' : '#fff'),
                opacity: isProcessing ? 0.6 : 1
              }}
            >
              Submit
            </button>
            <button
              onClick={() => dismissInteraction(item.id)}
              disabled={isProcessing}
              style={{
                flex: 1, padding: '8px 12px', fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                border: `1px solid ${colors.border}`, borderRadius: '6px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                background: colors.bgTertiary, color: colors.textTertiary, opacity: isProcessing ? 0.6 : 1
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )
    }

    // Fallback
    return (
      <button
        onClick={() => dismissInteraction(item.id)}
        style={{
          padding: '8px 12px', fontSize: fontSize.sm, border: `1px solid ${colors.border}`,
          borderRadius: '6px', cursor: 'pointer', background: colors.bgTertiary, color: colors.textTertiary
        }}
      >
        Dismiss
      </button>
    )
  }

  // --- Render accept/decline buttons ---
  const renderAcceptDecline = (
    onAccept: () => void,
    onDecline: () => void,
    isProcessing: boolean,
    acceptLabel = 'Accept',
    declineLabel = 'Decline'
  ) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={onAccept}
        disabled={isProcessing}
        style={{
          flex: 1, padding: '8px 12px', fontSize: fontSize.sm, fontWeight: fontWeight.medium,
          border: 'none', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer',
          background: isDarkMode ? '#4ade80' : '#22c55e', color: '#fff',
          opacity: isProcessing ? 0.6 : 1
        }}
      >
        {acceptLabel}
      </button>
      <button
        onClick={onDecline}
        disabled={isProcessing}
        style={{
          flex: 1, padding: '8px 12px', fontSize: fontSize.sm, fontWeight: fontWeight.medium,
          border: `1px solid ${colors.border}`, borderRadius: '6px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          background: colors.bgTertiary, color: colors.textPrimary,
          opacity: isProcessing ? 0.6 : 1
        }}
      >
        {declineLabel}
      </button>
    </div>
  )

  // --- Get card color based on item type ---
  const getCardColor = (item: InboxItem) => {
    if (item.type === 'event_invite') return isDarkMode ? '#60a5fa' : '#3b82f6' // blue
    if (item.type === 'friend_request') return isDarkMode ? '#a78bfa' : '#7c3aed' // purple
    if (item.type === 'aspect_invite') return (item.aspect as any)?.color || (isDarkMode ? '#34d399' : '#10b981') // aspect color or green
    // Interaction: use aspect color or priority-based
    if (item.aspect?.color) return item.aspect.color
    const p = item.priority || 3
    if (p >= 4) return isDarkMode ? '#f59e0b' : '#d97706'
    return isDarkMode ? '#6b7280' : '#9ca3af'
  }

  // --- Get type label ---
  const getTypeLabel = (item: InboxItem) => {
    if (item.type === 'event_invite') return 'Event Invite'
    if (item.type === 'friend_request') return 'Friend Request'
    if (item.type === 'aspect_invite') return 'Aspect Invite'
    return item.aspect?.name || 'Interaction'
  }

  // --- Render friend request card (matches FriendRequestItem style) ---
  const renderFriendRequestCard = (item: InboxItem) => {
    const isProcessing = processingIds.has(item.id)
    const requesterName = item.requester?.name || 'Someone'

    const buttonBase = {
      flex: 1,
      padding: '6px 10px',
      ...typography.labelSm,
      fontWeight: 500,
      borderRadius: '4px',
      cursor: isProcessing ? 'not-allowed' as const : 'pointer' as const,
      transition: 'all 0.15s',
      opacity: isProcessing ? 0.6 : 1,
    }

    return (
      <div
        key={item.id}
        style={{
          padding: '12px',
          background: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
        onMouseLeave={(e) => { e.currentTarget.style.background = colors.bgSecondary }}
      >
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            ...typography.labelLg,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {requesterName}
          </div>
          <div style={{
            ...typography.bodySm,
            color: colors.textSecondary,
          }}>
            sent you a friend request · {formatTimeAgo(item.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => handleAcceptFriend(item)}
            disabled={isProcessing}
            style={{
              ...buttonBase,
              background: '#2e7d32',
              color: 'white',
              border: 'none'
            }}
            onMouseEnter={(e) => { if (!isProcessing) e.currentTarget.style.background = '#1b5e20' }}
            onMouseLeave={(e) => { if (!isProcessing) e.currentTarget.style.background = '#2e7d32' }}
          >
            Accept
          </button>
          <button
            onClick={() => handleDeclineFriend(item)}
            disabled={isProcessing}
            style={{
              ...buttonBase,
              background: colors.bgTertiary,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) { e.currentTarget.style.background = colors.bgHover; e.currentTarget.style.color = colors.textPrimary }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) { e.currentTarget.style.background = colors.bgTertiary; e.currentTarget.style.color = colors.textSecondary }
            }}
          >
            Decline
          </button>
          <button
            onClick={() => handleBlockFriend(item)}
            disabled={isProcessing}
            style={{
              ...buttonBase,
              background: 'transparent',
              color: '#d32f2f',
              border: '1px solid #d32f2f'
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) { e.currentTarget.style.background = '#d32f2f'; e.currentTarget.style.color = 'white' }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#d32f2f' }
            }}
            title="Block this user"
          >
            Block
          </button>
        </div>
      </div>
    )
  }

  // --- Render event invite or interaction card ---
  const renderItem = (item: InboxItem) => {
    if (item.type === 'friend_request') return renderFriendRequestCard(item)

    const cardColor = getCardColor(item)
    const isProcessing = processingIds.has(item.id)

    return (
      <div
        key={item.id}
        style={{
          background: hexToRgba(cardColor, 0.12),
          padding: '10px',
          borderRadius: '8px',
          borderLeft: `3px solid ${cardColor}`,
          transition: 'box-shadow 0.15s'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '10px', fontWeight: fontWeight.medium,
              color: cardColor, background: hexToRgba(cardColor, 0.15),
              padding: '1px 6px', borderRadius: '3px'
            }}>
              {getTypeLabel(item)}
            </span>
            {(item.type === 'event_invite' || item.type === 'aspect_invite') && item.role && (
              <span style={{
                fontSize: '10px', fontWeight: fontWeight.medium,
                color: colors.textTertiary, background: hexToRgba(colors.textTertiary, 0.1),
                padding: '1px 6px', borderRadius: '3px'
              }}>
                {item.role === 'member' ? 'Full access' : 'View only'}
              </span>
            )}
            <span style={{ fontSize: '10px', color: colors.textTertiary }}>
              {formatTimeAgo(item.created_at)}
            </span>
          </div>
        </div>

        {/* Title */}
        <p style={{
          fontSize: fontSize.sm, lineHeight: lineHeight.normal,
          margin: '0 0 4px 0', color: colors.textPrimary, fontFamily: fontFamily.serif
        }}>
          {item.title}
        </p>

        {/* Subtitle (event time, etc.) */}
        {item.type === 'event_invite' && item.event?.start_time && (
          <p style={{
            fontSize: fontSize.xs, color: colors.textSecondary,
            margin: '0 0 8px 0'
          }}>
            {formatEventTime(item.event.start_time)}
            {item.event.location && ` - ${item.event.location}`}
          </p>
        )}

        {/* Actions */}
        {item.type === 'interaction' && (
          <div style={{ marginTop: '4px' }}>
            {renderInteractionOptions(item)}
          </div>
        )}

        {item.type === 'event_invite' && (
          <div style={{ marginTop: '4px' }}>
            {renderAcceptDecline(
              () => handleAcceptInvite(item),
              () => handleDeclineInvite(item),
              isProcessing
            )}
          </div>
        )}

        {item.type === 'aspect_invite' && (
          <div style={{ marginTop: '4px' }}>
            {renderAcceptDecline(
              () => handleAcceptAspect(item),
              () => handleDeclineAspect(item),
              isProcessing
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: colors.bgSecondary, overflow: 'hidden'
    }}>
      {/* Header */}
      {!hideHeader && (
        <div style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
          borderBottom: `1px solid ${colors.border}`, background: colors.bgSecondary
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{
              ...typography.headingLg, fontWeight: fontWeight.bold,
              margin: 0, color: colors.textPrimary
            }}>
              Inbox
            </h3>
            {items.length > 0 && (
              <span style={{ ...typography.labelMd, color: colors.textTertiary }}>
                {items.length}
              </span>
            )}
          </div>
          <RefreshButton
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh inbox"
          />
        </div>
      )}

      {hideHeader && (
        <div style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0
        }}>
          <span style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
            {items.length} items
          </span>
          <RefreshButton
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh inbox"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          margin: '0 16px 12px', padding: '10px 12px',
          background: hexToRgba(isDarkMode ? '#ef4444' : '#dc2626', 0.1),
          border: `1px solid ${hexToRgba(isDarkMode ? '#ef4444' : '#dc2626', 0.3)}`,
          borderRadius: '8px', fontSize: fontSize.sm,
          color: isDarkMode ? '#fca5a5' : '#dc2626'
        }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 16px 14px',
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
            {[1, 2].map((i) => (
              <div key={i} style={{
                background: colors.bgSecondary, padding: '14px', borderRadius: '10px',
                border: `1px solid ${colors.border}`
              }}>
                <div style={{
                  height: '14px', width: '80%', background: colors.bgTertiary,
                  borderRadius: '4px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                  height: '32px', width: '100%', background: colors.bgTertiary,
                  borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite'
                }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: colors.textTertiary }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ margin: '0 auto 12px auto', opacity: 0.5 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
            </svg>
            <p style={{ fontSize: fontSize.base, margin: '0 0 4px 0' }}>
              Inbox is empty
            </p>
            <p style={{ fontSize: fontSize.xs, margin: 0 }}>
              Event invites, friend requests, and check-ins will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Social items (friend requests + event/aspect invites) first */}
            {items.filter(i => i.type === 'friend_request' || i.type === 'event_invite' || i.type === 'aspect_invite').map(renderItem)}
            {/* Interactions below */}
            {items.filter(i => i.type === 'interaction').map(renderItem)}
          </>
        )}
      </div>
    </div>
  )
}
