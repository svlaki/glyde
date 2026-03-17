import type { Goal } from './goalService'

export interface TimelineItem {
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

interface TimelineRange {
  timelineStart: Date
  timelineEnd: Date
}

interface MonthMarker {
  date: Date
  label: string
  position: number
}

const DEFAULT_COLOR = '#3b82f6'

/**
 * Build timeline items from goals and milestones.
 * Returns the items and whether the timeline is date-based.
 */
export function buildTimelineItems(
  goals: Goal[],
  getAspectColor: (aspect?: string) => string
): { timelineItems: TimelineItem[]; isDateBased: boolean } {
  const items: TimelineItem[] = []
  let hasDateBasedItems = false
  let hasNonDateBasedItems = false

  goals.forEach(goal => {
    const goalColor = goal.aspect ? getAspectColor(goal.aspect) : DEFAULT_COLOR

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

    if (goal.milestones && Array.isArray(goal.milestones)) {
      const isOrderedType = goal.milestone_type === 'ordered'
      const totalMilestones = goal.milestones.length

      goal.milestones.forEach((milestone, index) => {
        if (milestone.due_date && !isOrderedType) {
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
          hasNonDateBasedItems = true
          const position = totalMilestones === 1
            ? 50
            : 5 + (index / (totalMilestones - 1)) * 90

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
}

/**
 * Calculate the start and end range of the timeline based on dated items.
 */
export function calculateTimelineRange(timelineItems: TimelineItem[]): TimelineRange {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

  const datedItems = timelineItems.filter(i => i.date !== null)

  if (datedItems.length === 0) {
    return { timelineStart: threeMonthsAgo, timelineEnd: oneYearFromNow }
  }

  const minDate = new Date(Math.min(...datedItems.map(i => i.date!.getTime())))
  const maxDate = new Date(Math.max(...datedItems.map(i => i.date!.getTime())))

  const rangeMs = Math.max(maxDate.getTime() - minDate.getTime(), 7 * 24 * 60 * 60 * 1000)
  const paddingMs = rangeMs * 0.05
  const start = new Date(minDate.getTime() - paddingMs)
  const end = new Date(maxDate.getTime() + paddingMs)

  return { timelineStart: start, timelineEnd: end }
}

/**
 * Generate month markers for a date-based timeline.
 */
export function generateMonthMarkers(timelineStart: Date, timelineEnd: Date): MonthMarker[] {
  const markers: MonthMarker[] = []
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
}

/**
 * Calculate today's position as a percentage on the timeline.
 */
export function calculateTodayPosition(timelineStart: Date, timelineEnd: Date): number {
  const now = new Date()
  const totalDays = (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
  const daysFromStart = (now.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100))
}
