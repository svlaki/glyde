import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDarkMode } from '../lib/darkModeContext'
import { useAuth } from '../lib/authContext'
import { useCategories } from '../lib/categoryContext'
import { getColors } from '../styles/colors'
import { Goal, updateUserGoal } from '../lib/goalService'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

// Accent colors not in theme
const ACCENT_COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444'
}

interface TimelineItem {
  id: string
  date: Date | null
  title: string
  type: 'milestone' | 'goal'
  goalId: string
  milestoneIndex?: number
  color?: string
  completed?: boolean
  position?: number // For non-dated items, 0-100 percentage
}

interface PlanTimelineProps {
  goals: Goal[]
  onMilestoneUpdate: () => void
  hideTitle?: boolean
}

const ITEM_TYPE = 'TIMELINE_ITEM'

interface DraggableItemProps {
  item: TimelineItem
  onDrop: (item: TimelineItem, newDate: Date) => void
  colors: ReturnType<typeof getColors>
  timelineStart: Date
  timelineEnd: Date
  containerWidth: number
}

interface SimpleTimelineItemProps {
  item: TimelineItem
  colors: ReturnType<typeof getColors>
  isDateBased: boolean
}

function SimpleTimelineItem({ item, colors, isDateBased }: SimpleTimelineItemProps) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const isGoal = item.type === 'goal'

  // Use pre-calculated position for non-dated items, or calculate from date
  const position = item.position ?? 50

  return (
    <div
      onMouseEnter={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHoverPos(null)}
      style={{
        position: 'absolute',
        left: `${position}%`,
        transform: 'translateX(-50%)',
        cursor: 'default',
        zIndex: hoverPos ? 50 : 1
      }}
    >
      {/* Hover tooltip */}
      {hoverPos && createPortal(
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
            fontSize: '12px',
            fontWeight: '500',
            color: colors.textPrimary
          }}>
            {item.title}
          </div>
          {item.date && (
            <div style={{
              fontSize: '11px',
              color: colors.textSecondary,
              marginTop: '2px'
            }}>
              {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Marker */}
      <div style={{
        width: isGoal ? '16px' : '12px',
        height: isGoal ? '16px' : '12px',
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
          fontSize: '10px',
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

function DraggableTimelineItem({ item, colors, timelineStart, timelineEnd, containerWidth }: DraggableItemProps) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
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

  return (
    <div
      ref={drag}
      onMouseEnter={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHoverPos(null)}
      style={{
        position: 'absolute',
        left: `${position}%`,
        transform: 'translateX(-50%)',
        cursor: item.type === 'milestone' ? 'grab' : 'default',
        opacity: isDragging ? 0.5 : 1,
        zIndex: hoverPos ? 50 : (isDragging ? 100 : 1)
      }}
    >
      {/* Hover tooltip - rendered via portal to escape overflow:hidden */}
      {hoverPos && createPortal(
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
            fontSize: '12px',
            fontWeight: '500',
            color: colors.textPrimary
          }}>
            {item.title}
          </div>
          {item.date && (
            <div style={{
              fontSize: '11px',
              color: colors.textSecondary,
              marginTop: '2px'
            }}>
              {item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Marker */}
      <div style={{
        width: isGoal ? '16px' : '12px',
        height: isGoal ? '16px' : '12px',
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
          fontSize: '10px',
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

function TimelineContent({ goals, onMilestoneUpdate, hideTitle = false }: PlanTimelineProps) {
  const { isDarkMode } = useDarkMode()
  const { user, accessToken } = useAuth()
  const { getCategoryColor } = useCategories()
  const colors = getColors(isDarkMode)
  const containerRef = useRef<HTMLDivElement>(null)

  // Build timeline items from goals and milestones
  const { timelineItems, isDateBased } = useMemo(() => {
    const items: TimelineItem[] = []
    let hasDateBasedItems = false
    let hasNonDateBasedItems = false

    goals.forEach(goal => {
      // Get color from category context (uses user's actual category colors)
      const goalColor = goal.category ? getCategoryColor(goal.category) : ACCENT_COLORS.primary

      // Add goal target date
      if (goal.target_date) {
        hasDateBasedItems = true
        items.push({
          id: `goal-${goal.id}`,
          date: new Date(goal.target_date),
          title: goal.title,
          type: 'goal',
          goalId: goal.id,
          color: goalColor,
          completed: goal.status === 'completed'
        })
      }

      // Add milestones
      if (goal.milestones && Array.isArray(goal.milestones)) {
        const isOrderedType = goal.milestone_type === 'ordered'
        const totalMilestones = goal.milestones.length

        goal.milestones.forEach((milestone, index) => {
          if (milestone.due_date && !isOrderedType) {
            // Date-based milestone
            hasDateBasedItems = true
            items.push({
              id: `milestone-${goal.id}-${index}`,
              date: new Date(milestone.due_date),
              title: milestone.title,
              type: 'milestone',
              goalId: goal.id,
              milestoneIndex: index,
              color: goalColor,
              completed: milestone.completed
            })
          } else if (isOrderedType || !milestone.due_date) {
            // Non-dated milestone - calculate equal spacing
            hasNonDateBasedItems = true
            // Space items evenly: first at ~10%, last at ~90%
            const position = totalMilestones === 1
              ? 50
              : 10 + (index / (totalMilestones - 1)) * 80

            items.push({
              id: `milestone-${goal.id}-${index}`,
              date: null,
              title: milestone.title,
              type: 'milestone',
              goalId: goal.id,
              milestoneIndex: index,
              color: goalColor,
              completed: milestone.completed,
              position
            })
          }
        })
      }
    })

    // Sort by date for date-based items, or by position for non-dated
    if (hasDateBasedItems && !hasNonDateBasedItems) {
      items.sort((a, b) => {
        if (!a.date || !b.date) return 0
        return a.date.getTime() - b.date.getTime()
      })
    } else if (hasNonDateBasedItems) {
      items.sort((a, b) => (a.position ?? 50) - (b.position ?? 50))
    }

    return {
      timelineItems: items,
      isDateBased: hasDateBasedItems && !hasNonDateBasedItems
    }
  }, [goals, getCategoryColor])

  // Calculate timeline range (only for date-based timelines)
  const { timelineStart, timelineEnd } = useMemo(() => {
    const now = new Date()
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    // Filter to only items with dates
    const datedItems = timelineItems.filter(i => i.date !== null)

    if (datedItems.length === 0) {
      return { timelineStart: threeMonthsAgo, timelineEnd: oneYearFromNow }
    }

    const minDate = new Date(Math.min(...datedItems.map(i => i.date!.getTime())))
    const maxDate = new Date(Math.max(...datedItems.map(i => i.date!.getTime())))

    // Add padding
    const start = new Date(Math.min(minDate.getTime(), now.getTime()) - 30 * 24 * 60 * 60 * 1000)
    const end = new Date(Math.max(maxDate.getTime(), now.getTime()) + 60 * 24 * 60 * 60 * 1000)

    return { timelineStart: start, timelineEnd: end }
  }, [timelineItems])

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

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: { date: Date; label: string; position: number }[] = []
    const current = new Date(timelineStart)
    current.setDate(1)
    current.setMonth(current.getMonth() + 1)

    const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)

    while (current < timelineEnd) {
      const daysFromStart = (current.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
      const position = (daysFromStart / totalDays) * 100

      markers.push({
        date: new Date(current),
        label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        position
      })

      current.setMonth(current.getMonth() + 1)
    }

    return markers
  }, [timelineStart, timelineEnd])

  // Calculate today's position
  const todayPosition = useMemo(() => {
    const now = new Date()
    const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
    const daysFromStart = (now.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100))
  }, [timelineStart, timelineEnd])

  // Get the primary goal's category color for background
  const primaryGoal = goals[0]
  const goalColor = getCategoryColor(primaryGoal?.category)
  const bgColor = `${goalColor}15` // 15 = ~8% opacity in hex

  if (timelineItems.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textSecondary,
        fontSize: '14px',
        background: bgColor,
        borderRadius: '8px'
      }}>
        No milestones yet. Add milestones to see your timeline.
      </div>
    )
  }

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
            />
          ))}
        </div>

        {/* Legend */}
        {!hideTitle && (
          <div style={{
            display: 'flex',
            gap: '20px',
            marginTop: '50px',
            fontSize: '12px',
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
          fontSize: '16px',
          fontWeight: '600',
          color: colors.textPrimary
        }}>
          Timeline
        </h3>
      )}

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
            fontSize: '10px',
            color: ACCENT_COLORS.error,
            fontWeight: '500',
            whiteSpace: 'nowrap'
          }}>
            Today
          </div>
        </div>

        {/* Month markers */}
        {monthMarkers.map((marker, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${marker.position}%`,
              top: '10px',
              transform: 'translateX(-50%)',
              fontSize: '10px',
              color: colors.textTertiary
            }}
          >
            {marker.label}
          </div>
        ))}

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
          />
        ))}
      </div>

      {/* Legend */}
      {!hideTitle && (
      <div style={{
        display: 'flex',
        gap: '20px',
        marginTop: '60px',
        fontSize: '12px',
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
  return (
    <DndProvider backend={HTML5Backend}>
      <TimelineContent {...props} />
    </DndProvider>
  )
}
