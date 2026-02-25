import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { usePlatform } from '../hooks/usePlatform'
import { fetchRatingSummary, fetchUserRatings, createUserRating } from '../lib/ratingService'
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
function ScoreDots({ score, onSelect, size = 28, interactive = false, colors }: {
  score: number
  onSelect?: (score: number) => void
  size?: number
  interactive?: boolean
  colors: ReturnType<typeof getColors>
}) {
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
        <button
          key={value}
          onClick={() => onSelect?.(value)}
          disabled={!interactive}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            border: value <= score
              ? `2px solid ${getScoreColor(score)}`
              : `2px solid ${colors.border}`,
            background: value <= score
              ? getScoreColor(score)
              : 'transparent',
            color: value <= score ? '#fff' : colors.textTertiary,
            fontSize: `${Math.max(10, size * 0.4)}px`,
            fontWeight: 600,
            cursor: interactive ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            if (interactive) e.currentTarget.style.transform = 'scale(1.15)'
          }}
          onMouseLeave={(e) => {
            if (interactive) e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {value}
        </button>
      ))}
    </div>
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
function RatingCard({ summary, isSelected, onClick, colors, isMobile }: {
  summary: RatingSummary
  isSelected: boolean
  onClick: () => void
  colors: ReturnType<typeof getColors>
  isMobile?: boolean
}) {
  const daysSince = Math.round((Date.now() - new Date(summary.lastAsked).getTime()) / 86400000)
  const timeAgo = daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince}d ago`

  return (
    <div
      onClick={onClick}
      style={{
        padding: isMobile ? '16px' : '14px 16px',
        background: isSelected ? hexToRgba(colors.textPrimary, 0.08) : colors.bgTertiary,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderLeft: isSelected ? `3px solid ${colors.textPrimary}` : '3px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = colors.bgHover
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = colors.bgTertiary
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span style={{
          fontSize: isMobile ? '15px' : '14px',
          fontWeight: 500,
          color: colors.textPrimary,
          flex: 1,
        }}>
          {summary.topic}
        </span>
        <TrendBadge trend={summary.trend} colors={colors} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ScoreDots score={summary.latestScore} size={20} colors={colors} />
        <span style={{ fontSize: '11px', color: colors.textTertiary }}>
          {summary.totalEntries} {summary.totalEntries === 1 ? 'entry' : 'entries'} / last: {timeAgo}
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
function RatingDetailPanel({ summary, history, onUpdateScore, colors, isMobile }: {
  summary: RatingSummary | null
  history: Rating[]
  onUpdateScore: (score: number) => void
  colors: ReturnType<typeof getColors>
  isMobile?: boolean
}) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
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

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary,
    }}>
      <VerticalSidebar />

      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        {/* Left panel - rating list */}
        <div style={{
          width: '350px',
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
                ...typography.headingLg,
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
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                + New
              </button>
            </div>
            <p style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              margin: '6px 0 0 0',
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
              summaries.map(s => (
                <RatingCard
                  key={s.topic}
                  summary={s}
                  isSelected={selectedTopic?.topic === s.topic}
                  onClick={() => handleSelectTopic(s)}
                  colors={colors}
                />
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
            {summaries.map(s => (
              <RatingCard
                key={s.topic}
                summary={s}
                isSelected={false}
                onClick={() => setSelectedTopic(s)}
                colors={colors}
                isMobile
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
