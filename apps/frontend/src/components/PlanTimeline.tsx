import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../lib/themeContext'
import { useAuth } from '../lib/authContext'
import { useAspects } from '../lib/aspectContext'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { updateUserGoal } from '../lib/goalService'
import type { Goal } from '../lib/goalService'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { usePlatform } from '../hooks/usePlatform'
import {
  buildTimelineItems,
  calculateTimelineRange,
  generateMonthMarkers,
  calculateTodayPosition
} from '../lib/timelineUtils'
import type { TimelineItem } from '../lib/timelineUtils'

// Accent colors not in theme
const ACCENT_COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444'
}

// TimelineItem imported from ../lib/timelineUtils

interface PlanTimelineProps {
  goals: Goal[]
  onMilestoneUpdate: () => void
  hideTitle?: boolean
  onChatReply?: (message: string) => void
}

const ITEM_TYPE = 'TIMELINE_ITEM'

interface DraggableItemProps {
  item: TimelineItem
  onDrop: (item: TimelineItem, newDate: Date) => void
  colors: ReturnType<typeof getColors>
  timelineStart: Date
  timelineEnd: Date
  containerWidth: number
  isMobile?: boolean
}

interface SimpleTimelineItemProps {
  item: TimelineItem
  colors: ReturnType<typeof getColors>
  isDateBased: boolean
  isMobile?: boolean
}

function SimpleTimelineItem({ item, colors, isDateBased, isMobile = false }: SimpleTimelineItemProps) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [tapped, setTapped] = useState(false)
  const isGoal = item.type === 'goal'

  // Use pre-calculated position for non-dated items, or calculate from date
  const position = item.position ?? 50

  const showTooltip = isMobile ? tapped : !!hoverPos

  return (
    <div
      onMouseEnter={isMobile ? undefined : (e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={isMobile ? undefined : (e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={isMobile ? undefined : () => setHoverPos(null)}
      onClick={isMobile ? () => setTapped(prev => !prev) : undefined}
      style={{
        position: 'absolute',
        left: `${position}%`,
        transform: 'translateX(-50%)',
        cursor: isMobile ? 'pointer' : 'default',
        zIndex: showTooltip ? 50 : 1
      }}
    >
      {/* Tooltip */}
      {showTooltip && (isMobile ? (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 12px',
          background: colors.bgPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
          zIndex: 9999,
          marginBottom: '8px'
        }}>
          <div style={{
            fontSize: fontSize.xs,
            fontWeight: fontWeight.medium,
            color: colors.textPrimary
          }}>
            {item.title}
          </div>
          {item.date && (
            <div style={{
              fontSize: fontSize.xs,
              color: colors.textSecondary,
              marginTop: '2px'
            }}>
              {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
      ) : (
        hoverPos && createPortal(
          <div style={{
            position: 'fixed',
            top: hoverPos.y + 20,
            left: hoverPos.x,
            transform: 'translateX(-50%)',
            padding: '8px 12px',
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none'
          }}>
            <div style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              color: colors.textPrimary
            }}>
              {item.title}
            </div>
            {item.date && (
              <div style={{
                fontSize: fontSize.xs,
                color: colors.textSecondary,
                marginTop: '2px'
              }}>
                {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>,
          document.body
        )
      ))}

      {/* Marker */}
      <div style={{
        width: isGoal ? (isMobile ? '24px' : '16px') : (isMobile ? '20px' : '12px'),
        height: isGoal ? (isMobile ? '24px' : '16px') : (isMobile ? '20px' : '12px'),
        borderRadius: '50%',
        background: item.completed ? ACCENT_COLORS.success : (item.color || ACCENT_COLORS.primary),
        border: `2px solid ${colors.bgPrimary}`,
        boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
        marginBottom: '4px'
      }} />

      {/* Label + Date combined */}
      <div style={{
        position: 'absolute',
        top: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        cursor: 'default'
      }}>
        <div style={{
          fontSize: fontSize.xs,
          color: colors.textSecondary,
          maxWidth: '80px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {item.title}
        </div>
        {isDateBased && item.date && (
          <div style={{
            fontSize: '9px',
            color: colors.textTertiary,
            marginTop: '2px'
          }}>
            {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableTimelineItem({ item, colors, timelineStart, timelineEnd, containerWidth, isMobile = false }: DraggableItemProps) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [tapped, setTapped] = useState(false)
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ITEM_TYPE,
    item: { ...item },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [item])

  // Calculate position on timeline
  const totalDays = Math.max(1, (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24))
  const daysFromStart = item.date ? (item.date.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24) : 0
  const position = item.position ?? Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100))

  const isGoal = item.type === 'goal'
  const showTooltip = isMobile ? tapped : !!hoverPos

  return (
    <div
      ref={drag}
      onMouseEnter={isMobile ? undefined : (e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={isMobile ? undefined : (e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={isMobile ? undefined : () => setHoverPos(null)}
      onClick={isMobile ? () => setTapped(prev => !prev) : undefined}
      style={{
        position: 'absolute',
        left: `${position}%`,
        transform: 'translateX(-50%)',
        cursor: item.type === 'milestone' ? 'grab' : (isMobile ? 'pointer' : 'default'),
        opacity: isDragging ? 0.5 : 1,
        zIndex: showTooltip ? 50 : (isDragging ? 100 : 1),
        padding: isMobile ? '8px' : 0,
        margin: isMobile ? '-8px' : 0
      }}
    >
      {/* Tooltip */}
      {showTooltip && (isMobile ? (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 12px',
          background: colors.bgPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
          zIndex: 9999,
          marginBottom: '8px'
        }}>
          <div style={{
            fontSize: fontSize.xs,
            fontWeight: fontWeight.medium,
            color: colors.textPrimary
          }}>
            {item.title}
          </div>
          {item.date && (
            <div style={{
              fontSize: fontSize.xs,
              color: colors.textSecondary,
              marginTop: '2px'
            }}>
              {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
      ) : (
        hoverPos && createPortal(
          <div style={{
            position: 'fixed',
            top: hoverPos.y + 20,
            left: hoverPos.x,
            transform: 'translateX(-50%)',
            padding: '8px 12px',
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            pointerEvents: 'none'
          }}>
            <div style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              color: colors.textPrimary
            }}>
              {item.title}
            </div>
            {item.date && (
              <div style={{
                fontSize: fontSize.xs,
                color: colors.textSecondary,
                marginTop: '2px'
              }}>
                {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>,
          document.body
        )
      ))}

      {/* Marker */}
      <div style={{
        width: isGoal ? (isMobile ? '24px' : '16px') : (isMobile ? '20px' : '12px'),
        height: isGoal ? (isMobile ? '24px' : '16px') : (isMobile ? '20px' : '12px'),
        borderRadius: '50%',
        background: item.completed ? ACCENT_COLORS.success : (item.color || ACCENT_COLORS.primary),
        border: `2px solid ${colors.bgPrimary}`,
        boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
        marginBottom: '4px'
      }} />

      {/* Label + Date combined */}
      <div style={{
        position: 'absolute',
        top: isMobile ? '28px' : '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        cursor: 'default'
      }}>
        <div style={{
          fontSize: fontSize.xs,
          color: colors.textSecondary,
          maxWidth: '80px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {item.title}
        </div>
        {item.date && (
          <div style={{
            fontSize: '9px',
            color: colors.textTertiary,
            marginTop: '2px'
          }}>
            {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineContent({ goals, onMilestoneUpdate, hideTitle = false, onChatReply }: PlanTimelineProps) {
  const { theme, isDarkMode } = useTheme()
  const { user, accessToken } = useAuth()
  const { getAspectColor } = useAspects()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dismissedOverdue, setDismissedOverdue] = useState<Set<string>>(new Set())

  // Detect overdue milestones (past due, not completed)
  const overdueMilestones = useMemo(() => {
    const now = new Date()
    const overdue: Array<{
      key: string
      goalId: string
      goalTitle: string
      milestoneIndex: number
      milestoneTitle: string
      dueDate: string
      color: string
    }> = []

    goals.forEach(goal => {
      const goalColor = goal.aspect ? getAspectColor(goal.aspect) : ACCENT_COLORS.primary
      goal.milestones?.forEach((ms, idx) => {
        if (!ms.completed && ms.due_date && new Date(ms.due_date) < now) {
          overdue.push({
            key: `${goal.id}-${idx}`,
            goalId: goal.id,
            goalTitle: goal.title,
            milestoneIndex: idx,
            milestoneTitle: ms.title,
            dueDate: ms.due_date,
            color: goalColor
          })
        }
      })
    })
    return overdue
  }, [goals, getAspectColor])

  const visibleOverdue = overdueMilestones.filter(m => !dismissedOverdue.has(m.key))

  // Mark a milestone as complete
  const handleMilestoneComplete = async (goalId: string, milestoneIndex: number, key: string) => {
    if (!user || !accessToken) return
    const goal = goals.find(g => g.id === goalId)
    if (!goal?.milestones) return

    const updatedMilestones = goal.milestones.map((ms, idx) =>
      idx === milestoneIndex ? { ...ms, completed: true } : ms
    )

    const result = await updateUserGoal(user, accessToken, goalId, { milestones: updatedMilestones })
    if (!result.error) {
      setDismissedOverdue(prev => new Set([...prev, key]))
      onMilestoneUpdate()
    }
  }

  // Send to chat for discussion
  const handleMilestoneNotComplete = (goalTitle: string, milestoneTitle: string, key: string) => {
    setDismissedOverdue(prev => new Set([...prev, key]))
    onChatReply?.(`I didn't complete the milestone "${milestoneTitle}" for my goal "${goalTitle}". Can we discuss re-adjusting the timeline?`)
  }

  // Build timeline items from goals and milestones (shared util)
  const { timelineItems, isDateBased } = useMemo(
    () => buildTimelineItems(goals, getAspectColor),
    [goals, getAspectColor]
  )

  // Calculate timeline range (shared util)
  const { timelineStart, timelineEnd } = useMemo(
    () => calculateTimelineRange(timelineItems),
    [timelineItems]
  )

  // Handle milestone drop
  const handleDrop = async (item: TimelineItem, newDate: Date) => {
    if (!user || !accessToken || item.type !== 'milestone') return

    const goal = goals.find(g => g.id === item.goalId)
    if (!goal || !goal.milestones || item.milestoneIndex === undefined) return

    // Update milestone date
    const updatedMilestones = [...goal.milestones]
    updatedMilestones[item.milestoneIndex] = {
      ...updatedMilestones[item.milestoneIndex],
      due_date: newDate.toISOString().split('T')[0]
    }

    const result = await updateUserGoal(user, accessToken, goal.id, {
      milestones: updatedMilestones
    })

    if (!result.error) {
      onMilestoneUpdate()
    }
  }

  // Drop target for the timeline
  const [, drop] = useDrop(() => ({
    accept: ITEM_TYPE,
    drop: (draggedItem: TimelineItem, monitor) => {
      const offset = monitor.getClientOffset()
      if (!offset || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = offset.x - rect.left
      const percentage = x / rect.width

      // Calculate new date based on position
      const totalMs = timelineEnd.getTime() - timelineStart.getTime()
      const newDate = new Date(timelineStart.getTime() + (percentage * totalMs))

      handleDrop(draggedItem, newDate)
    }
  }), [timelineStart, timelineEnd, goals, handleDrop])

  // Generate month markers (shared util)
  const monthMarkers = useMemo(
    () => generateMonthMarkers(timelineStart, timelineEnd),
    [timelineStart, timelineEnd]
  )

  // Calculate today's position (shared util)
  const todayPosition = useMemo(
    () => calculateTodayPosition(timelineStart, timelineEnd),
    [timelineStart, timelineEnd]
  )

  // Get the primary goal's category color for background
  const primaryGoal = goals[0]
  const goalColor = getAspectColor(primaryGoal?.aspect)
  const bgColor = `${goalColor}15` // 15 = ~8% opacity in hex

  if (timelineItems.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textSecondary,
        fontSize: fontSize.base,
        background: bgColor,
        borderRadius: '8px'
      }}>
        No milestones yet. Add milestones to see your timeline.
      </div>
    )
  }

  // Overdue milestone prompt cards
  const overdueCards = visibleOverdue.length > 0 ? (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginBottom: hideTitle ? '8px' : '12px'
    }}>
      {visibleOverdue.map(m => (
        <div key={m.key} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: hideTitle ? '8px 10px' : '10px 14px',
          background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderLeft: `3px solid ${m.color}`,
          borderRadius: '6px'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.textPrimary
            }}>
              Did you complete: {m.milestoneTitle}?
            </div>
            <div style={{
              fontSize: fontSize.xs,
              color: colors.textTertiary,
              marginTop: '2px'
            }}>
              Due {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => handleMilestoneComplete(m.goalId, m.milestoneIndex, m.key)}
              style={{
                padding: '5px 12px',
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
                background: ACCENT_COLORS.success,
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Yes
            </button>
            <button
              onClick={() => handleMilestoneNotComplete(m.goalTitle, m.milestoneTitle, m.key)}
              style={{
                padding: '5px 12px',
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
                background: 'transparent',
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              No
            </button>
          </div>
        </div>
      ))}
    </div>
  ) : null

  // For non-date-based timeline, render a simpler view
  if (!isDateBased) {
    return (
      <div style={{
        height: '100%',
        padding: hideTitle ? '10px' : '20px',
        overflow: 'visible',
        background: bgColor,
        borderRadius: '8px'
      }}>
        {!hideTitle && (
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: colors.textPrimary
          }}>
            Progress
          </h3>
        )}

        {overdueCards}

        {/* Simple timeline container */}
        <div style={{
          position: 'relative',
          height: hideTitle ? '60px' : '80px',
          marginTop: hideTitle ? '0' : '20px'
        }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            top: '6px',
            left: '5%',
            right: '5%',
            height: '2px',
            background: colors.border
          }} />

          {/* Start marker */}
          <div style={{
            position: 'absolute',
            left: '5%',
            top: '0',
            width: '4px',
            height: '14px',
            background: colors.border,
            borderRadius: '2px'
          }} />

          {/* End marker */}
          <div style={{
            position: 'absolute',
            right: '5%',
            top: '0',
            width: '4px',
            height: '14px',
            background: colors.border,
            borderRadius: '2px'
          }} />

          {/* Timeline items - equally spaced */}
          {timelineItems.map(item => (
            <SimpleTimelineItem
              key={item.id}
              item={item}
              colors={colors}
              isDateBased={false}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* Legend */}
        {!hideTitle && (
          <div style={{
            display: 'flex',
            gap: '20px',
            marginTop: '50px',
            fontSize: fontSize.xs,
            color: colors.textSecondary
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: colors.border
              }} />
              <span>Pending</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: ACCENT_COLORS.success
              }} />
              <span>Complete</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      padding: hideTitle ? '10px' : '20px',
      overflow: 'visible',
      background: bgColor,
      borderRadius: '8px'
    }}>
      {!hideTitle && (
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: colors.textPrimary
        }}>
          Timeline
        </h3>
      )}

      {overdueCards}

      {/* Timeline container */}
      <div
        ref={(node) => {
          drop(node)
          if (node) (containerRef as any).current = node
        }}
        style={{
          position: 'relative',
          height: hideTitle ? '60px' : '100px',
          marginTop: hideTitle ? '0' : '20px'
        }}
      >
        {/* Timeline line */}
        <div style={{
          position: 'absolute',
          top: '6px',
          left: 0,
          right: 0,
          height: '2px',
          background: colors.border
        }} />

        {/* Today marker */}
        <div style={{
          position: 'absolute',
          left: `${todayPosition}%`,
          top: '-8px',
          bottom: '-20px',
          width: '2px',
          background: ACCENT_COLORS.error,
          zIndex: 0
        }}>
          <div style={{
            position: 'absolute',
            top: '-16px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: fontSize.xs,
            color: ACCENT_COLORS.error,
            fontWeight: fontWeight.medium,
            whiteSpace: 'nowrap'
          }}>
            Today
          </div>
        </div>


        {/* Timeline items */}
        {timelineItems.map(item => (
          <DraggableTimelineItem
            key={item.id}
            item={item}
            onDrop={handleDrop}
            colors={colors}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            containerWidth={containerRef.current?.clientWidth || 800}
            isMobile={isMobile}
          />
        ))}
      </div>

      {/* Legend */}
      {!hideTitle && (
      <div style={{
        display: 'flex',
        gap: '20px',
        marginTop: '60px',
        fontSize: fontSize.xs,
        color: colors.textSecondary
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: ACCENT_COLORS.primary
          }} />
          <span>Milestone (drag to reschedule)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: ACCENT_COLORS.primary
          }} />
          <span>Goal target</span>
        </div>
      </div>
      )}
    </div>
  )
}

export function PlanTimeline(props: PlanTimelineProps) {
  const { isMobile } = usePlatform()
  const backend = isMobile ? TouchBackend : HTML5Backend
  const options = isMobile ? { enableMouseEvents: true } : undefined

  return (
    <DndProvider backend={backend} options={options}>
      <TimelineContent {...props} />
    </DndProvider>
  )
}
