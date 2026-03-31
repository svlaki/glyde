import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { usePlatform } from '../hooks/usePlatform'
import { fetchRatingSummary, fetchUserRatings, createUserRating, deleteRatingTopic, updateRatingTopic, reorderRatingTopics } from '../lib/ratingService'
import type { RatingSummary, Rating } from '../lib/ratingService'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

export function RatingsPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <RatingsPageMobile />
  }

  return <RatingsPageDesktop />
}

// Score dot component for the 1-10 scale
function ScoreDots({ score, onSelect, size = 28, interactive = false, colors, hoverPreview = false }: {
  score: number
  onSelect?: (score: number) => void
  size?: number
  interactive?: boolean
  colors: ReturnType<typeof getColors>
  hoverPreview?: boolean
}) {
  const [hoverValue, setHoverValue] = useState(0)
  const displayScore = hoverPreview && hoverValue > 0 ? hoverValue : score

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => {
        const isFilled = value <= displayScore
        const fillColor = getScoreColor(displayScore || value)
        return (
          <button
            key={value}
            onClick={() => onSelect?.(value)}
            disabled={!interactive}
            onMouseEnter={(e) => {
              if (interactive) {
                e.currentTarget.style.transform = 'scale(1.2)'
                if (hoverPreview) setHoverValue(value)
              }
            }}
            onMouseLeave={(e) => {
              if (interactive) {
                e.currentTarget.style.transform = 'scale(1)'
                if (hoverPreview) setHoverValue(0)
              }
            }}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: '50%',
              border: isFilled
                ? `2px solid ${fillColor}`
                : `1.5px solid ${colors.border}`,
              background: isFilled ? fillColor : 'transparent',
              color: isFilled ? '#fff' : colors.textTertiary,
              fontSize: `${Math.max(10, size * 0.38)}px`,
              fontWeight: 600,
              cursor: interactive ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.18s ease',
              padding: 0,
            }}
          >
            {value}
          </button>
        )
      })}
    </div>
  )
}

// Mini sparkline SVG for rating history
function Sparkline({ history, color, width = 120, height = 32 }: {
  history: { score: number }[]
  color: string
  width?: number
  height?: number
}) {
  if (history.length < 2) return null
  const points = history.slice(-12).reverse() // Last 12 entries, chronological
  const max = 10
  const min = 0
  const stepX = width / (points.length - 1)
  const pathPoints = points.map((p, i) => {
    const x = i * stepX
    const y = height - ((p.score - min) / (max - min)) * (height - 4) - 2
    return `${x},${y}`
  })
  const pathD = `M ${pathPoints.join(' L ')}`

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
      {/* Latest point dot */}
      {points.length > 0 && (() => {
        const lastI = points.length - 1
        const lx = lastI * stepX
        const ly = height - ((points[lastI].score - min) / (max - min)) * (height - 4) - 2
        return <circle cx={lx} cy={ly} r="3" fill={color} />
      })()}
    </svg>
  )
}

function getScoreColor(value: number): string {
  if (value <= 2) return '#ef4444'
  if (value <= 4) return '#f97316'
  if (value <= 6) return '#eab308'
  if (value <= 8) return '#22c55e'
  return '#10b981'
}

// Trend indicator
function TrendBadge({ trend, colors }: { trend: number, colors: ReturnType<typeof getColors> }) {
  if (trend === 0) {
    return (
      <span style={{
        fontSize: '11px',
        color: colors.textTertiary,
        background: hexToRgba(colors.textTertiary, 0.1),
        padding: '2px 8px',
        borderRadius: '4px',
      }}>
        stable
      </span>
    )
  }

  const isUp = trend > 0
  return (
    <span style={{
      fontSize: '11px',
      color: isUp ? '#22c55e' : '#ef4444',
      background: isUp ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      padding: '2px 8px',
      borderRadius: '4px',
      fontWeight: 500,
    }}>
      {isUp ? '+' : ''}{trend} {isUp ? 'up' : 'down'}
    </span>
  )
}

// Rating card for the summary list
function RatingCard({ summary, isSelected, onClick, colors, isMobile, history }: {
  summary: RatingSummary
  isSelected: boolean
  onClick: () => void
  colors: ReturnType<typeof getColors>
  isMobile?: boolean
  history?: { score: number }[]
}) {
  const daysSince = Math.round((Date.now() - new Date(summary.lastAsked).getTime()) / 86400000)
  const timeAgo = daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince}d ago`
  const scoreColor = getScoreColor(summary.latestScore)

  return (
    <div
      onClick={onClick}
      className="card-reveal"
      style={{
        flex: 1,
        minWidth: 0,
        padding: isMobile ? '16px' : '14px 16px',
        background: isSelected ? hexToRgba(colors.textPrimary, 0.06) : colors.bgPrimary,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        border: isSelected ? `1px solid ${hexToRgba(colors.textPrimary, 0.15)}` : `1px solid ${colors.border}`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = colors.bgHover
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = isSelected ? hexToRgba(colors.textPrimary, 0.06) : colors.bgPrimary
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {/* Large score circle */}
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: scoreColor,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {summary.latestScore}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: isMobile ? '15px' : '14px',
              fontWeight: 600,
              color: colors.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {summary.topic}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                {summary.totalEntries} {summary.totalEntries === 1 ? 'entry' : 'entries'}
              </span>
              <TrendBadge trend={summary.trend} colors={colors} />
            </div>
          </div>
        </div>
        {/* Mini sparkline if history exists */}
        {history && history.length >= 2 && (
          <Sparkline history={history} color={scoreColor} width={80} height={24} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ScoreDots score={summary.latestScore} size={18} colors={colors} />
        <span style={{ fontSize: '11px', color: colors.textTertiary, flexShrink: 0, marginLeft: '8px' }}>
          {timeAgo}
        </span>
      </div>
    </div>
  )
}

// New rating form
function NewRatingForm({ onSave, onCancel, colors, isMobile }: {
  onSave: (topic: string, score: number, description?: string) => void
  onCancel: () => void
  colors: ReturnType<typeof getColors>
  isMobile?: boolean
}) {
  const [topic, setTopic] = useState('')
  const [score, setScore] = useState(0)
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    if (!topic.trim() || score === 0) return
    onSave(topic.trim(), score, description.trim() || undefined)
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.textPrimary,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{
      padding: isMobile ? '16px' : '20px',
      background: colors.bgSecondary,
      borderRadius: '10px',
      border: `1px solid ${colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      <div style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary }}>
        New Rating
      </div>

      <div>
        <label style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>
          Topic
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Sleep quality, Work-life balance..."
          style={inputStyle}
          autoFocus
        />
      </div>

      <div>
        <label style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px', display: 'block' }}>
          Score (1-10)
        </label>
        <ScoreDots score={score} onSelect={setScore} size={36} interactive colors={colors} />
      </div>

      <div>
        <label style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px', display: 'block' }}>
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this rating measure?"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            color: colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!topic.trim() || score === 0}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            background: !topic.trim() || score === 0 ? colors.bgTertiary : colors.textPrimary,
            border: 'none',
            borderRadius: '6px',
            color: !topic.trim() || score === 0 ? colors.textTertiary : colors.bgPrimary,
            cursor: !topic.trim() || score === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

// Detail panel showing history for a selected rating
function RatingDetailPanel({ summary, history, onUpdateScore, onDelete, onEdit, colors, isMobile }: {
  summary: RatingSummary | null
  history: Rating[]
  onUpdateScore: (score: number) => void
  onDelete?: (topic: string) => void
  onEdit?: (oldTopic: string, newTopic: string, newDescription: string) => void
  colors: ReturnType<typeof getColors>
  isMobile?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTopic, setEditTopic] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!summary) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: colors.textTertiary,
        fontSize: '14px',
      }}>
        Select a rating to view history
      </div>
    )
  }

  const handleStartEdit = () => {
    setEditTopic(summary.topic)
    setEditDescription(summary.description || '')
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (!editTopic.trim()) return
    onEdit?.(summary.topic, editTopic.trim(), editDescription.trim())
    setIsEditing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with edit/delete actions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {isEditing ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginRight: '12px' }}>
              <input
                type="text"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setIsEditing(false) }}
                autoFocus
                style={{
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: 600,
                  color: colors.textPrimary,
                  background: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                style={{
                  fontSize: '14px',
                  color: colors.textSecondary,
                  background: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editTopic.trim()}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    background: colors.textPrimary,
                    color: colors.bgPrimary,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    background: 'transparent',
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <h2 style={{
                  fontSize: isMobile ? '20px' : '22px',
                  fontWeight: 600,
                  color: colors.textPrimary,
                  margin: '0 0 4px 0',
                }}>
                  {summary.topic}
                </h2>
                {summary.description && (
                  <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>
                    {summary.description}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={handleStartEdit}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: 'transparent',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.error,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '8px',
            background: hexToRgba(colors.error, 0.06),
            border: `1px solid ${hexToRgba(colors.error, 0.2)}`,
          }}>
            <div style={{ fontSize: '13px', color: colors.textPrimary, marginBottom: '8px' }}>
              Delete &ldquo;{summary.topic}&rdquo; and all {summary.totalEntries} entries? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => { onDelete?.(summary.topic); setConfirmDelete(false) }}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  background: colors.error,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current score + update */}
      <div style={{
        padding: '20px',
        background: colors.bgTertiary,
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: 500 }}>
          Current score
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontSize: '48px',
            fontWeight: 700,
            color: getScoreColor(summary.latestScore),
            lineHeight: 1,
          }}>
            {summary.latestScore}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', color: colors.textSecondary }}>out of 10</span>
            <TrendBadge trend={summary.trend} colors={colors} />
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
          <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>
            Update score
          </div>
          <ScoreDots
            score={0}
            onSelect={onUpdateScore}
            size={36}
            interactive
            hoverPreview
            colors={colors}
          />
        </div>
      </div>

      {/* History */}
      <div>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: '12px',
        }}>
          History ({history.length} {history.length === 1 ? 'entry' : 'entries'})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {history.map((entry) => {
            const date = new Date(entry.created_at)
            const formatted = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
            })
            const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: colors.bgTertiary,
                  borderRadius: '6px',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: getScoreColor(entry.score),
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {entry.score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: colors.textPrimary }}>
                    {formatted} at {time}
                  </div>
                  {entry.notes && (
                    <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '2px' }}>
                      {entry.notes}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {history.length === 0 && (
            <div style={{ fontSize: '13px', color: colors.textTertiary, padding: '8px 0' }}>
              No entries yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Desktop layout
function RatingsPageDesktop() {
  const { user, session } = useAuth()
  const { theme } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const [summaries, setSummaries] = useState<RatingSummary[]>([])
  const [selectedTopic, setSelectedTopic] = useState<RatingSummary | null>(null)
  const [history, setHistory] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)

  const loadSummaries = useCallback(async () => {
    if (!user || !session) return
    setLoading(true)
    const { summary } = await fetchRatingSummary(user, session.access_token)
    setSummaries(summary)
    setLoading(false)
  }, [user, session])

  // Load history when topic selected
  const loadHistory = useCallback(async (topic: string) => {
    if (!user || !session) return
    const { ratings } = await fetchUserRatings(user, session.access_token, topic)
    setHistory(ratings)
  }, [user, session])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  useEffect(() => {
    if (selectedTopic) {
      loadHistory(selectedTopic.topic)
    }
  }, [selectedTopic, loadHistory])

  const handleSelectTopic = (summary: RatingSummary) => {
    setSelectedTopic(summary)
    setShowNewForm(false)
  }

  const handleCreateRating = async (topic: string, score: number, description?: string) => {
    if (!user || !session) return
    await createUserRating(user, session.access_token, { topic, score, description })
    setShowNewForm(false)
    await loadSummaries()
    // Select the newly created rating
    const { summary } = await fetchRatingSummary(user, session.access_token)
    const created = summary.find(s => s.topic === topic)
    if (created) {
      setSelectedTopic(created)
      loadHistory(topic)
    }
  }

  const handleUpdateScore = async (score: number) => {
    if (!user || !session || !selectedTopic) return
    await createUserRating(user, session.access_token, {
      topic: selectedTopic.topic,
      score,
      description: selectedTopic.description,
    })
    await loadSummaries()
    // Refresh selected topic
    const { summary } = await fetchRatingSummary(user, session.access_token)
    const updated = summary.find(s => s.topic === selectedTopic.topic)
    if (updated) {
      setSelectedTopic(updated)
      loadHistory(updated.topic)
    }
  }

  const handleDeleteTopic = async (topic: string) => {
    if (!user || !session) return
    const result = await deleteRatingTopic(user, session.access_token, topic)
    if (!result.success) {
      console.error('Failed to delete rating:', result.error)
      return
    }
    setSelectedTopic(null)
    setHistory([])
    await loadSummaries()
  }

  const handleEditTopic = async (oldTopic: string, newTopic: string, newDescription: string) => {
    if (!user || !session) return
    const updates: { topic?: string; description?: string } = {}
    if (newTopic !== oldTopic) updates.topic = newTopic
    updates.description = newDescription
    const result = await updateRatingTopic(user, session.access_token, oldTopic, updates)
    if (!result.success) {
      console.error('Failed to update rating:', result.error)
      return
    }
    await loadSummaries()
    const lookupTopic = updates.topic ?? oldTopic
    const { summary } = await fetchRatingSummary(user, session.access_token)
    const updated = summary.find(s => s.topic === lookupTopic)
    if (updated) {
      setSelectedTopic(updated)
      loadHistory(lookupTopic)
    }
  }

  const handleMoveRating = async (index: number, direction: 'up' | 'down') => {
    if (!user || !session) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= summaries.length) return

    const reordered = [...summaries]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)

    // Optimistic update
    setSummaries(reordered)

    // Persist
    const topicOrder = reordered.map(s => s.topic)
    await reorderRatingTopics(user, session.access_token, topicOrder)
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary,
    }}>
      <VerticalSidebar />

      <div className="page-enter" style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        {/* Left panel - rating list */}
        <div style={{
          width: '380px',
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{
                ...typography.displaySm,
                fontWeight: 600,
                color: colors.textPrimary,
                margin: 0,
              }}>
                Ratings
              </h2>
              <button
                onClick={() => { setShowNewForm(true); setSelectedTopic(null) }}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  background: colors.textPrimary,
                  color: colors.bgPrimary,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              >
                + New
              </button>
            </div>
            <p style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              margin: '8px 0 0 0',
            }}>
              Track how you feel about areas of your life
            </p>
          </div>

          {/* List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.textTertiary, fontSize: '14px' }}>
                Loading...
              </div>
            ) : summaries.length === 0 && !showNewForm ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: '14px', color: colors.textTertiary }}>
                  No ratings yet
                </div>
                <div style={{ fontSize: '13px', color: colors.textTertiary }}>
                  Your AI assistant will suggest ratings, or create one manually.
                </div>
              </div>
            ) : (
              summaries.map((s, idx) => (
                <div key={s.topic} style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
                  <RatingCard
                    summary={s}
                    isSelected={selectedTopic?.topic === s.topic}
                    onClick={() => handleSelectTopic(s)}
                    colors={colors}
                  />
                  {/* Reorder arrows */}
                  {summaries.length > 1 && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '2px',
                      flexShrink: 0,
                    }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveRating(idx, 'up') }}
                        disabled={idx === 0}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'transparent',
                          color: idx === 0 ? colors.border : colors.textTertiary,
                          cursor: idx === 0 ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          padding: 0,
                          transition: 'color 0.15s',
                        }}
                        title="Move up"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveRating(idx, 'down') }}
                        disabled={idx === summaries.length - 1}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'transparent',
                          color: idx === summaries.length - 1 ? colors.border : colors.textTertiary,
                          cursor: idx === summaries.length - 1 ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          padding: 0,
                          transition: 'color 0.15s',
                        }}
                        title="Move down"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel - detail or form */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '30px',
        }}>
          {showNewForm ? (
            <NewRatingForm
              onSave={handleCreateRating}
              onCancel={() => setShowNewForm(false)}
              colors={colors}
            />
          ) : (
            <RatingDetailPanel
              summary={selectedTopic}
              history={history}
              onUpdateScore={handleUpdateScore}
              onDelete={handleDeleteTopic}
              onEdit={handleEditTopic}
              colors={colors}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Mobile layout
function RatingsPageMobile() {
  const { user, session } = useAuth()
  const { theme } = useTheme()
  const colors = getColors(theme)
  const [summaries, setSummaries] = useState<RatingSummary[]>([])
  const [selectedTopic, setSelectedTopic] = useState<RatingSummary | null>(null)
  const [history, setHistory] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)

  const loadSummaries = useCallback(async () => {
    if (!user || !session) return
    setLoading(true)
    const { summary } = await fetchRatingSummary(user, session.access_token)
    setSummaries(summary)
    setLoading(false)
  }, [user, session])

  const loadHistory = useCallback(async (topic: string) => {
    if (!user || !session) return
    const { ratings } = await fetchUserRatings(user, session.access_token, topic)
    setHistory(ratings)
  }, [user, session])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  useEffect(() => {
    if (selectedTopic) {
      loadHistory(selectedTopic.topic)
    }
  }, [selectedTopic, loadHistory])

  const handleCreateRating = async (topic: string, score: number, description?: string) => {
    if (!user || !session) return
    await createUserRating(user, session.access_token, { topic, score, description })
    setShowNewForm(false)
    await loadSummaries()
  }

  const handleUpdateScore = async (score: number) => {
    if (!user || !session || !selectedTopic) return
    await createUserRating(user, session.access_token, {
      topic: selectedTopic.topic,
      score,
      description: selectedTopic.description,
    })
    await loadSummaries()
    const { summary } = await fetchRatingSummary(user, session.access_token)
    const updated = summary.find(s => s.topic === selectedTopic.topic)
    if (updated) {
      setSelectedTopic(updated)
      loadHistory(updated.topic)
    }
  }

  const handleDeleteTopic = async (topic: string) => {
    if (!user || !session) return
    const result = await deleteRatingTopic(user, session.access_token, topic)
    if (!result.success) {
      console.error('Failed to delete rating:', result.error)
      return
    }
    setSelectedTopic(null)
    setHistory([])
    await loadSummaries()
  }

  const handleEditTopic = async (oldTopic: string, newTopic: string, newDescription: string) => {
    if (!user || !session) return
    const updates: { topic?: string; description?: string } = {}
    if (newTopic !== oldTopic) updates.topic = newTopic
    updates.description = newDescription
    const result = await updateRatingTopic(user, session.access_token, oldTopic, updates)
    if (!result.success) {
      console.error('Failed to update rating:', result.error)
      return
    }
    await loadSummaries()
    const lookupTopic = updates.topic ?? oldTopic
    const { summary } = await fetchRatingSummary(user, session.access_token)
    const updated = summary.find(s => s.topic === lookupTopic)
    if (updated) {
      setSelectedTopic(updated)
      loadHistory(lookupTopic)
    }
  }

  const handleMoveRating = async (index: number, direction: 'up' | 'down') => {
    if (!user || !session) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= summaries.length) return

    const reordered = [...summaries]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    setSummaries(reordered)

    const topicOrder = reordered.map(s => s.topic)
    await reorderRatingTopics(user, session.access_token, topicOrder)
  }

  const handleBack = () => {
    setSelectedTopic(null)
    setShowNewForm(false)
  }

  // Detail view
  if (selectedTopic) {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader title={selectedTopic.topic} onBack={handleBack} />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          paddingLeft: mobileSpacing.paddingX,
          paddingRight: mobileSpacing.paddingX,
          paddingTop: mobileSpacing.paddingTop,
          paddingBottom: mobileSpacing.paddingBottomNoTabs,
        }}>
          <RatingDetailPanel
            summary={selectedTopic}
            history={history}
            onUpdateScore={handleUpdateScore}
            onDelete={(topic) => { handleDeleteTopic(topic); handleBack() }}
            onEdit={handleEditTopic}
            colors={colors}
            isMobile
          />
        </div>
      </div>
    )
  }

  // New form view
  if (showNewForm) {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader title="New Rating" onBack={handleBack} />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          paddingLeft: mobileSpacing.paddingX,
          paddingRight: mobileSpacing.paddingX,
          paddingTop: mobileSpacing.paddingTop,
          paddingBottom: mobileSpacing.paddingBottomNoTabs,
        }}>
          <NewRatingForm
            onSave={handleCreateRating}
            onCancel={handleBack}
            colors={colors}
            isMobile
          />
        </div>
      </div>
    )
  }

  // List view
  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Ratings" showMenu showSearch />
      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs,
      }}>
        {/* Add button */}
        <button
          onClick={() => setShowNewForm(true)}
          style={{
            width: '100%',
            padding: '12px',
            background: colors.bgTertiary,
            border: `1px dashed ${colors.border}`,
            borderRadius: '8px',
            color: colors.textSecondary,
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '16px',
          }}
        >
          + Add New Rating
        </button>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: colors.textTertiary, fontSize: '14px' }}>
            Loading...
          </div>
        ) : summaries.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: colors.textTertiary,
            fontSize: '14px',
            lineHeight: '1.5',
          }}>
            No ratings yet. Your AI assistant will suggest ratings, or tap the button above to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {summaries.map((s, idx) => (
              <div key={s.topic} style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
                <RatingCard
                  summary={s}
                  isSelected={false}
                  onClick={() => setSelectedTopic(s)}
                  colors={colors}
                  isMobile
                />
                {summaries.length > 1 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '4px',
                    flexShrink: 0,
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveRating(idx, 'up') }}
                      disabled={idx === 0}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: `1px solid ${colors.border}`,
                        background: 'transparent',
                        color: idx === 0 ? colors.border : colors.textTertiary,
                        cursor: idx === 0 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveRating(idx, 'down') }}
                      disabled={idx === summaries.length - 1}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: `1px solid ${colors.border}`,
                        background: 'transparent',
                        color: idx === summaries.length - 1 ? colors.border : colors.textTertiary,
                        cursor: idx === summaries.length - 1 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
