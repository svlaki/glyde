import { useState, useRef, useEffect, useMemo } from 'react'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { getColors } from '../styles/colors'
import { getTypography, fontSize, fontWeight } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { PlanTimeline } from './PlanTimeline'
import { GoalsSection } from './GoalsSection'
import type { Goal } from '../lib/goalService'
import { buildTimelineItems, calculateTimelineRange } from '../lib/timelineUtils'

interface TabbedGoalsPanelProps {
  goals: Goal[]
  onMilestoneUpdate: () => void
  onChatReply?: (message: string) => void
}

type TabType = 'timeline' | 'goals'

export function TabbedGoalsPanel({ goals, onMilestoneUpdate, onChatReply }: TabbedGoalsPanelProps) {
  const { theme } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)
  const [activeTab, setActiveTab] = useState<TabType>('timeline')

  const goalsWithMilestones = goals.filter(g => g.milestones && g.milestones.length > 0)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: colors.bgPrimary,
      borderRadius: isMobile ? '0' : '12px',
      border: isMobile ? 'none' : `1px solid ${colors.border}`,
      overflow: 'hidden'
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
        padding: '0 16px'
      }}>
        <TabButton
          label="Timeline"
          isActive={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
          colors={colors}
          typography={typography}
        />
        <TabButton
          label="Goals"
          isActive={activeTab === 'goals'}
          onClick={() => setActiveTab('goals')}
          colors={colors}
          typography={typography}
        />
      </div>

      {/* Tab content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        minHeight: 0
      }}>
        {activeTab === 'timeline' ? (
          <TimelineTab
            goals={goals}
            goalsWithMilestones={goalsWithMilestones}
            onMilestoneUpdate={onMilestoneUpdate}
            onChatReply={onChatReply}
          />
        ) : (
          <GoalsSection />
        )}
      </div>
    </div>
  )
}

interface TabButtonProps {
  label: string
  isActive: boolean
  onClick: () => void
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
}

function TabButton({ label, isActive, onClick, colors }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 20px',
        fontSize: fontSize.sm,
        fontWeight: isActive ? fontWeight.semibold : fontWeight.regular,
        color: isActive ? colors.textPrimary : colors.textSecondary,
        background: 'transparent',
        border: 'none',
        borderBottom: isActive ? `2px solid ${colors.textPrimary}` : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: '-1px'
      }}
    >
      {label}
    </button>
  )
}

interface TimelineTabProps {
  goals: Goal[]
  goalsWithMilestones: Goal[]
  onMilestoneUpdate: () => void
  onChatReply?: (message: string) => void
}

function TimelineTab({ goals, goalsWithMilestones, onMilestoneUpdate, onChatReply }: TimelineTabProps) {
  const { theme } = useTheme()
  const { getAspectColor } = useAspects()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Build a combined timeline for all goals
  const { timelineItems } = useMemo(
    () => buildTimelineItems(goals, getAspectColor),
    [goals, getAspectColor]
  )

  const { timelineStart, timelineEnd } = useMemo(
    () => calculateTimelineRange(timelineItems),
    [timelineItems]
  )

  // Auto-scroll to "today" on mobile mount
  useEffect(() => {
    if (isMobile && scrollRef.current && timelineItems.length > 0) {
      const now = new Date()
      const totalMs = timelineEnd.getTime() - timelineStart.getTime()
      const nowMs = now.getTime() - timelineStart.getTime()
      const pct = Math.max(0, Math.min(1, nowMs / totalMs))
      const scrollTarget = pct * scrollRef.current.scrollWidth - scrollRef.current.clientWidth / 2
      scrollRef.current.scrollLeft = Math.max(0, scrollTarget)
    }
  }, [isMobile, timelineItems, timelineStart, timelineEnd])

  if (goalsWithMilestones.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        textAlign: 'center'
      }}>
        No goals with milestones yet. Create goals with milestones to see their timelines.
      </div>
    )
  }

  const milestoneCount = timelineItems.length

  return (
    <div style={{ padding: '16px' }}>
      {/* Per-goal timeline lanes */}
      <div
        ref={scrollRef}
        style={{
          ...(isMobile ? {
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch' as any,
            // Hide scrollbar
            scrollbarWidth: 'none' as any,
            msOverflowStyle: 'none' as any
          } : {}),
        }}
      >
        <div style={{
          ...(isMobile ? {
            minWidth: `${Math.max(100, milestoneCount * 90)}px`
          } : {}),
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {goalsWithMilestones.map(goal => {
            const goalColor = goal.aspect ? getAspectColor(goal.aspect) : '#3b82f6'

            return (
              <div key={goal.id} style={{
                background: colors.bgSecondary,
                borderRadius: '8px',
                padding: '12px',
                borderLeft: `3px solid ${goalColor}`
              }}>
                <div style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: colors.textPrimary,
                  marginBottom: '8px'
                }}>
                  {goal.title}
                </div>
                <div style={{ height: isMobile ? '80px' : '60px' }}>
                  <PlanTimeline
                    goals={[goal]}
                    onMilestoneUpdate={onMilestoneUpdate}
                    onChatReply={onChatReply}
                    hideTitle
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* CSS to hide scrollbar */}
      {isMobile && (
        <style>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>
      )}
    </div>
  )
}
