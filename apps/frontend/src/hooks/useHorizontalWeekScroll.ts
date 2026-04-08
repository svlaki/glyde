import { useEffect, useLayoutEffect, useCallback, useState, useRef, type RefObject } from 'react'

interface UseHorizontalWeekScrollOptions {
  scrollRef: RefObject<HTMLDivElement | null>
  currentDate: Date
  onDateChange: (date: Date) => void
  view: 'day' | 'week' | 'month'
  enabled?: boolean
}

interface UseHorizontalWeekScrollReturn {
  getBufferedWeekDates: () => Date[]
  isDraggingNearEdge: boolean
}

const TIME_GUTTER_WIDTH = 52
const BUFFER_WEEKS = 9 // 9 weeks total: 4 before + current + 4 after
const CENTER_WEEK = 4  // Index of center week (0-based)
const RECENTER_THRESHOLD = 3 // Re-center when scrolled 3+ weeks from center

export function useHorizontalWeekScroll({
  scrollRef,
  currentDate,
  onDateChange,
  view,
  enabled = true,
}: UseHorizontalWeekScrollOptions): UseHorizontalWeekScrollReturn {
  const [isDraggingNearEdge, setIsDraggingNearEdge] = useState(false)
  const isShifting = useRef(false)
  const savedVerticalScroll = useRef(0)

  const getWeekStart = useCallback((date: Date) => {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const getBufferedWeekDates = useCallback(() => {
    if (view !== 'week' || !enabled) {
      const start = getWeekStart(currentDate)
      const dates: Date[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        dates.push(d)
      }
      return dates
    }

    const start = getWeekStart(currentDate)
    const dates: Date[] = []
    for (let w = -CENTER_WEEK; w < BUFFER_WEEKS - CENTER_WEEK; w++) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + (w * 7) + i)
        dates.push(d)
      }
    }
    return dates
  }, [currentDate, view, enabled, getWeekStart])

  const getWeekWidth = useCallback(() => {
    const el = scrollRef.current
    if (!el) return 0
    // Time gutter is now outside the scroll container, so week = full width
    return el.clientWidth
  }, [scrollRef])

  // Set scroll to center week BEFORE browser paints (prevents jitter)
  useLayoutEffect(() => {
    if (view !== 'week' || !enabled) return undefined

    const el = scrollRef.current
    if (!el) return undefined

    const weekWidth = getWeekWidth()
    if (weekWidth === 0) {
      // Element not yet laid out; fall back to rAF
      const frame = requestAnimationFrame(() => {
        const w = getWeekWidth()
        if (w > 0 && el) {
          el.scrollLeft = CENTER_WEEK * w
          if (savedVerticalScroll.current > 0) {
            el.scrollTop = savedVerticalScroll.current
          }
          isShifting.current = false
        }
      })
      return () => cancelAnimationFrame(frame)
    }

    el.scrollLeft = CENTER_WEEK * weekWidth
    if (savedVerticalScroll.current > 0) {
      el.scrollTop = savedVerticalScroll.current
    }
    isShifting.current = false
    return undefined
  }, [currentDate, view, enabled, scrollRef, getWeekWidth])

  // Detect when scrolled far from center and re-center
  useEffect(() => {
    if (view !== 'week' || !enabled) return

    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      if (isShifting.current) return

      const weekWidth = getWeekWidth()
      if (weekWidth === 0) return

      const scrollLeft = el.scrollLeft
      const currentWeekIndex = Math.round(scrollLeft / weekWidth)
      const drift = currentWeekIndex - CENTER_WEEK

      if (Math.abs(drift) >= RECENTER_THRESHOLD) {
        isShifting.current = true
        savedVerticalScroll.current = el.scrollTop
        const newDate = new Date(currentDate)
        newDate.setDate(newDate.getDate() + drift * 7)
        onDateChange(newDate)
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [view, enabled, currentDate, onDateChange, scrollRef, getWeekWidth])

  // Auto-scroll when dragging near left/right edges
  useEffect(() => {
    if (view !== 'week' || !enabled) return

    const el = scrollRef.current
    if (!el) return

    const edgeZone = 60
    const scrollSpeed = 8
    let autoFrame: number | null = null

    const onDragOver = (e: DragEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const width = rect.width

      if (x < edgeZone || x > width - edgeZone) {
        const direction = x < edgeZone ? -1 : 1
        setIsDraggingNearEdge(true)
        if (!autoFrame) {
          const tick = () => {
            el.scrollLeft += scrollSpeed * direction
            autoFrame = requestAnimationFrame(tick)
          }
          autoFrame = requestAnimationFrame(tick)
        }
      } else {
        if (autoFrame) {
          cancelAnimationFrame(autoFrame)
          autoFrame = null
        }
        setIsDraggingNearEdge(false)
      }
    }

    const stop = () => {
      if (autoFrame) {
        cancelAnimationFrame(autoFrame)
        autoFrame = null
      }
      setIsDraggingNearEdge(false)
    }

    el.addEventListener('dragover', onDragOver, { passive: true })
    el.addEventListener('dragend', stop)
    el.addEventListener('drop', stop)

    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragend', stop)
      el.removeEventListener('drop', stop)
      stop()
    }
  }, [view, enabled, scrollRef])

  return {
    getBufferedWeekDates,
    isDraggingNearEdge,
  }
}
