interface EventTiming {
  id: string
  start_time: string
  end_time: string
}

interface EventColumn {
  id: string
  column: number
  totalColumns: number
}

interface EventLayoutOptions {
  leftOffset?: number   // px, e.g., 58 for mobile day view gutter
  rightMargin?: number  // px
  minWidthPercent?: number // minimum event width, e.g., 45% for touch targets
}

interface EventLayout {
  width: string
  left: string
  right: string
  zIndex: number
}

/**
 * Core column-packing overlap algorithm (like Google Calendar).
 * 1. Sort events by start time (longest first for ties)
 * 2. Build clusters of transitively overlapping events
 * 3. Within each cluster, greedily assign columns (lowest available column per event)
 * 4. Return { id, column, totalColumns } per event
 */
export function computeEventColumns(events: EventTiming[]): EventColumn[] {
  if (events.length === 0) return []

  // Sort: earliest start first, longest duration first for ties
  const sorted = [...events].sort((a, b) => {
    const aStart = new Date(a.start_time).getTime()
    const bStart = new Date(b.start_time).getTime()
    if (aStart !== bStart) return aStart - bStart
    const aDur = new Date(a.end_time).getTime() - aStart
    const bDur = new Date(b.end_time).getTime() - bStart
    return bDur - aDur // longest first
  })

  // Helper: do two events overlap?
  const overlaps = (a: EventTiming, b: EventTiming): boolean => {
    const aStart = new Date(a.start_time).getTime()
    const aEnd = new Date(a.end_time).getTime()
    const bStart = new Date(b.start_time).getTime()
    const bEnd = new Date(b.end_time).getTime()
    return aStart < bEnd && bStart < aEnd
  }

  // Build clusters of transitively overlapping events
  const clusters: EventTiming[][] = []
  let currentCluster: EventTiming[] = []
  let clusterEnd = 0

  for (const event of sorted) {
    const eventStart = new Date(event.start_time).getTime()
    const eventEnd = new Date(event.end_time).getTime()

    if (currentCluster.length === 0 || eventStart < clusterEnd) {
      currentCluster.push(event)
      clusterEnd = Math.max(clusterEnd, eventEnd)
    } else {
      clusters.push(currentCluster)
      currentCluster = [event]
      clusterEnd = eventEnd
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  // For each cluster, greedily assign columns
  const result: EventColumn[] = []

  for (const cluster of clusters) {
    const columnAssignments = new Map<string, number>()
    const columnEnds: number[] = [] // track end time of last event in each column

    for (const event of cluster) {
      const eventStart = new Date(event.start_time).getTime()

      // Find lowest available column
      let assignedCol = -1
      for (let col = 0; col < columnEnds.length; col++) {
        if (columnEnds[col] <= eventStart) {
          assignedCol = col
          break
        }
      }

      // Also check: is there a column where this event doesn't overlap with any existing event?
      if (assignedCol === -1) {
        // Check all columns for actual overlap (not just end time)
        for (let col = 0; col < columnEnds.length; col++) {
          const colEvents = cluster.filter(e => columnAssignments.get(e.id) === col)
          const hasOverlap = colEvents.some(e => overlaps(e, event))
          if (!hasOverlap) {
            assignedCol = col
            break
          }
        }
      }

      if (assignedCol === -1) {
        assignedCol = columnEnds.length
        columnEnds.push(0)
      }

      columnAssignments.set(event.id, assignedCol)
      columnEnds[assignedCol] = Math.max(
        columnEnds[assignedCol],
        new Date(event.end_time).getTime()
      )
    }

    const totalColumns = columnEnds.length

    for (const event of cluster) {
      result.push({
        id: event.id,
        column: columnAssignments.get(event.id)!,
        totalColumns
      })
    }
  }

  return result
}

/**
 * Produces a Map<eventId, { width, left, right, zIndex }> for positioning
 * overlapping events within a day column.
 */
export function computeDayEventLayouts(
  dayEvents: EventTiming[],
  options: EventLayoutOptions = {}
): Map<string, EventLayout> {
  const {
    leftOffset = 0,
    rightMargin = 0,
    minWidthPercent = 50
  } = options

  const layouts = new Map<string, EventLayout>()

  if (dayEvents.length === 0) return layouts

  const columns = computeEventColumns(dayEvents)

  for (const { id, column, totalColumns } of columns) {
    if (totalColumns <= 1) {
      // No overlap - full width
      if (leftOffset > 0) {
        layouts.set(id, {
          width: `calc(100% - ${leftOffset + rightMargin}px)`,
          left: `${leftOffset}px`,
          right: `${rightMargin}px`,
          zIndex: 3
        })
      } else {
        layouts.set(id, {
          width: `calc(100% - ${rightMargin + 4}px)`,
          left: '2px',
          right: `${Math.max(rightMargin, 2)}px`,
          zIndex: 3
        })
      }
    } else {
      // Overlapping: compute column-based layout
      const widthPercent = Math.max(minWidthPercent, 100 / totalColumns)
      const stepPercent = (100 - widthPercent) / Math.max(1, totalColumns - 1)
      const offsetPercent = column * stepPercent

      if (leftOffset > 0) {
        // Mobile: use calc() to combine pixel offset with percentage
        const availableWidth = `(100% - ${leftOffset + rightMargin}px)`
        layouts.set(id, {
          width: `calc(${availableWidth} * ${widthPercent / 100})`,
          left: `calc(${leftOffset}px + ${availableWidth} * ${offsetPercent / 100})`,
          right: 'auto',
          zIndex: 3 + column
        })
      } else {
        // Desktop: pure percentage
        layouts.set(id, {
          width: `${widthPercent}%`,
          left: `${offsetPercent}%`,
          right: 'auto',
          zIndex: 3 + column
        })
      }
    }
  }

  return layouts
}
