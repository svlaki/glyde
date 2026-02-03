import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../lib/authContext'
import { useCategories } from '../../lib/categoryContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { fetchExpandedEvents, updateEvent, deleteEvent, createEvent, deleteRecurringEvent } from '../../lib/calendarService'
import { supabase } from '../../lib/supabase'
import { getColors, hexToRgba } from '../../styles/colors'
import { EventForm } from '../EventForm'
import { EventFormMobile } from './EventFormMobile'
import { RecurringEventView } from '../RecurringEventView'
import { EditRecurringEventModal } from '../EditRecurringEventModal'
import { getRecurrenceBadge } from '../../lib/recurrenceUtils'
import { usePlatform } from '../../hooks/usePlatform'

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  description?: string
  category?: string
  color?: string
  recurrence_rule?: string
  parent_event_id?: string
  is_recurring?: boolean
  is_instance?: boolean
}

type MobileViewType = 'day' | '3day' | 'month'

interface MobileCalendarProps {
  view: MobileViewType
  currentDate: Date
  onDateChange: (date: Date) => void
  onDisplayDateChange?: (date: Date) => void  // Updates header without affecting buffer
  hideMonthDayHeaders?: boolean
  scrollToDate?: Date | null  // Scroll to this date within buffer without re-centering
}

export function MobileCalendar({ view, currentDate, onDateChange, onDisplayDateChange, hideMonthDayHeaders = false, scrollToDate }: MobileCalendarProps) {
  const { user, session } = useAuth()
  const { getCategoryColor } = useCategories()
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = useState(() => (window.innerWidth - 40) / 3)

  // Recurring event view state
  const [recurringEventToView, setRecurringEventToView] = useState<CalendarEvent | null>(null)
  const [isRecurringViewOpen, setIsRecurringViewOpen] = useState(false)

  // Recurring event edit state
  const [recurringEventToEdit, setRecurringEventToEdit] = useState<CalendarEvent | null>(null)
  const [isRecurringEditOpen, setIsRecurringEditOpen] = useState(false)

  // Drag state for events
  const [isDragging, setIsDragging] = useState(false)
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragStartY, setDragStartY] = useState<number>(0)
  const [dragCurrentY, setDragCurrentY] = useState<number>(0)

  // Cross-day drag state (for 3-day view)
  const [dragStartX, setDragStartX] = useState<number>(0)
  const [dragCurrentX, setDragCurrentX] = useState<number>(0)
  const [targetDayIndex, setTargetDayIndex] = useState<number | null>(null)
  const [sourceDayIndex, setSourceDayIndex] = useState<number | null>(null)

  // Touch state for events (hold to drag)
  const [touchedEvent, setTouchedEvent] = useState<CalendarEvent | null>(null)
  const [isInEditMode, setIsInEditMode] = useState(false)
  const [eventTouchTimer, setEventTouchTimer] = useState<NodeJS.Timeout | null>(null)

  // Refs for touch handlers
  const isInEditModeRef = useRef(false)
  const isDraggingRef = useRef(false)
  const draggingEventRef = useRef<CalendarEvent | null>(null)
  const dragStartYRef = useRef(0)
  const dragCurrentYRef = useRef(0)
  const touchedEventRef = useRef<CalendarEvent | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)
  const touchStartTimeRef = useRef(0)

  // Refs for cross-day drag (3-day view)
  const dragStartXRef = useRef(0)
  const dragCurrentXRef = useRef(0)
  const targetDayIndexRef = useRef<number | null>(null)
  const sourceDayIndexRef = useRef<number | null>(null)
  const lastScrollUpdateRef = useRef(0)

  // Refs for scroll direction locking with full manual control
  const scrollGestureRef = useRef<{
    phase: 'idle' | 'buffering' | 'locked'
    direction: 'horizontal' | 'vertical' | null
    startTime: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    lastTime: number
    velocityX: number
    velocityY: number
    scrollLeftAtStart: number
    scrollTopAtStart: number
    rafId: number | null
    momentumRafId: number | null
  }>({
    phase: 'idle',
    direction: null,
    startTime: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
    scrollLeftAtStart: 0,
    scrollTopAtStart: 0,
    rafId: null,
    momentumRafId: null
  })

  // Get event color based on category
  const getEventColor = (event: CalendarEvent): string => {
    if (event.category) {
      return getCategoryColor(event.category)
    }
    return event.color || '#3b82f6'
  }

  // Get month dates (for month view grid)
  const getMonthDates = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const dates = []

    for (let i = startDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      dates.push(prevDate)
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i))
    }

    const totalDays = 42
    for (let i = 1; dates.length < totalDays; i++) {
      dates.push(new Date(year, month + 1, i))
    }

    return dates
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toDateString()
    return events.filter(event => {
      const eventDate = new Date(event.start_time)
      return eventDate.toDateString() === dateStr
    })
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Get date for a specific column index in the buffer
  const getDateForColumnIndex = (index: number): Date => {
    const d = new Date(currentDate)
    d.setDate(currentDate.getDate() - 31 + index)  // Index 31 = currentDate
    d.setHours(0, 0, 0, 0)
    return d
  }

  // Get column index from X position relative to container
  const getColumnIndexFromX = (clientX: number): number | null => {
    if (!scrollContainerRef.current) return null
    const containerRect = scrollContainerRef.current.getBoundingClientRect()
    const scrollLeft = scrollContainerRef.current.scrollLeft
    // Account for the 40px time gutter
    const relativeX = clientX - containerRect.left - 40 + scrollLeft
    if (relativeX < 0) return null
    return Math.floor(relativeX / columnWidth)
  }

  // Get visible days for continuous scrolling (renders days for scrolling)
  // 63 days total: 31 days before (buffer) + target date at index 31 + 31 days after
  const getVisibleDays = (startDate: Date, daysToShow: number = 63): Date[] => {
    const dates: Date[] = []
    const startOffset = -31  // 31 days before the target date
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + startOffset + i)
      d.setHours(0, 0, 0, 0)
      dates.push(d)
    }
    return dates
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
  }

  // Handle horizontal scroll to update currentDate for seamless infinite scrolling
  const handleHorizontalScroll = () => {
    if (!scrollContainerRef.current || isDragging) return

    // Use actual container width instead of viewport width
    const containerWidth = scrollContainerRef.current.clientWidth
    const columnWidth = (containerWidth - 40) / 3
    const scrollLeft = scrollContainerRef.current.scrollLeft
    // Target date is at index 31 (left-most visible column)
    const targetIndex = 31
    const targetScrollLeft = targetIndex * columnWidth
    const scrolledColumns = Math.round((scrollLeft - targetScrollLeft) / columnWidth)

    // Always update the display date for the header (throttled)
    if (onDisplayDateChange && scrolledColumns !== 0) {
      const visibleDate = new Date(currentDate)
      visibleDate.setDate(visibleDate.getDate() + scrolledColumns)
      onDisplayDateChange(visibleDate)
    }

    // Only re-center buffer when scrolled 20+ columns from target position
    const now = Date.now()
    if (now - lastScrollUpdateRef.current < 300) return

    if (Math.abs(scrolledColumns) >= 20) {
      lastScrollUpdateRef.current = now

      // Calculate offset within current column position
      const offsetWithinColumn = scrollLeft - (Math.round(scrollLeft / columnWidth) * columnWidth)

      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + scrolledColumns)

      onDateChange(newDate)
      // Reset scroll position after state update for seamless experience
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = targetScrollLeft + offsetWithinColumn
          }
        })
      })
    }
  }

  // Direction-locking touch handlers with FULL manual scroll control
  // Both horizontal AND vertical are handled manually for perfect axis locking
  useEffect(() => {
    if (view !== '3day') return
    const container = scrollContainerRef.current
    if (!container) return

    const TOUCH_SLOP = 10
    const VELOCITY_DECAY = 0.95  // Momentum decay per frame
    const MIN_VELOCITY = 0.5    // Stop momentum below this threshold
    const gesture = scrollGestureRef.current

    // Stop any ongoing momentum animation
    const stopMomentum = () => {
      if (gesture.momentumRafId) {
        cancelAnimationFrame(gesture.momentumRafId)
        gesture.momentumRafId = null
      }
    }

    const resetGesture = () => {
      if (gesture.rafId) {
        cancelAnimationFrame(gesture.rafId)
        gesture.rafId = null
      }
      gesture.phase = 'idle'
      gesture.direction = null
      gesture.velocityX = 0
      gesture.velocityY = 0
    }

    // Momentum animation loop
    const animateMomentum = () => {
      if (gesture.direction === 'horizontal') {
        gesture.velocityX *= VELOCITY_DECAY
        if (Math.abs(gesture.velocityX) < MIN_VELOCITY) {
          stopMomentum()
          return
        }
        container.scrollLeft -= gesture.velocityX
      } else if (gesture.direction === 'vertical') {
        gesture.velocityY *= VELOCITY_DECAY
        if (Math.abs(gesture.velocityY) < MIN_VELOCITY) {
          stopMomentum()
          return
        }
        // Clamp scroll to bounds for rubber-band-like feel at edges
        const maxScrollTop = container.scrollHeight - container.clientHeight
        const newScrollTop = container.scrollTop - gesture.velocityY

        if (newScrollTop < 0) {
          container.scrollTop = 0
          gesture.velocityY *= 0.5  // Dampen at edge
        } else if (newScrollTop > maxScrollTop) {
          container.scrollTop = maxScrollTop
          gesture.velocityY *= 0.5  // Dampen at edge
        } else {
          container.scrollTop = newScrollTop
        }
      }

      gesture.momentumRafId = requestAnimationFrame(animateMomentum)
    }

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.calendar-event') || touchedEventRef.current) return

      const touch = e.touches[0]
      if (!touch) return

      // Stop any ongoing momentum
      stopMomentum()

      const now = Date.now()
      gesture.phase = 'buffering'
      gesture.direction = null
      gesture.startTime = now
      gesture.startX = touch.clientX
      gesture.startY = touch.clientY
      gesture.lastX = touch.clientX
      gesture.lastY = touch.clientY
      gesture.lastTime = now
      gesture.velocityX = 0
      gesture.velocityY = 0
      gesture.scrollLeftAtStart = container.scrollLeft
      gesture.scrollTopAtStart = container.scrollTop
    }

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.calendar-event') || touchedEventRef.current) {
        e.preventDefault()
        return
      }

      const touch = e.touches[0]
      if (!touch || gesture.phase === 'idle') return

      const now = Date.now()
      const deltaX = touch.clientX - gesture.lastX
      const deltaY = touch.clientY - gesture.lastY
      const dt = Math.max(now - gesture.lastTime, 1)  // Avoid division by zero

      // Track velocity for momentum (exponential moving average)
      const alpha = 0.4  // Smoothing factor
      gesture.velocityX = alpha * (deltaX / dt * 16) + (1 - alpha) * gesture.velocityX
      gesture.velocityY = alpha * (deltaY / dt * 16) + (1 - alpha) * gesture.velocityY

      gesture.lastX = touch.clientX
      gesture.lastY = touch.clientY
      gesture.lastTime = now

      if (gesture.phase === 'buffering') {
        const totalDx = touch.clientX - gesture.startX
        const totalDy = touch.clientY - gesture.startY
        const absDx = Math.abs(totalDx)
        const absDy = Math.abs(totalDy)

        // Check if we've exceeded touch slop
        if (absDx > TOUCH_SLOP || absDy > TOUCH_SLOP) {
          // Lock to dominant axis
          gesture.direction = absDx > absDy ? 'horizontal' : 'vertical'
          gesture.phase = 'locked'
          // Prevent default from now on - we handle ALL scrolling
          e.preventDefault()
        }
      } else if (gesture.phase === 'locked') {
        // Always prevent default - we control scrolling completely
        e.preventDefault()

        if (gesture.direction === 'horizontal') {
          // Only update horizontal scroll
          container.scrollLeft -= deltaX
        } else {
          // Only update vertical scroll
          container.scrollTop -= deltaY
        }
      }
    }

    const handleTouchEnd = () => {
      if (gesture.phase === 'locked') {
        // Start momentum animation if there's significant velocity
        const velocity = gesture.direction === 'horizontal'
          ? Math.abs(gesture.velocityX)
          : Math.abs(gesture.velocityY)

        if (velocity > MIN_VELOCITY * 2) {
          gesture.momentumRafId = requestAnimationFrame(animateMomentum)
        }
      }
      // Reset phase but keep momentum running
      gesture.phase = 'idle'
    }

    const handleTouchCancel = () => {
      stopMomentum()
      resetGesture()
    }

    // Prevent native scroll completely in 3day view
    const handleWheel = (e: WheelEvent) => {
      // Allow scroll wheel for non-touch devices
      // but constrain to single axis based on which delta is larger
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        container.scrollLeft += e.deltaX
      } else {
        container.scrollTop += e.deltaY
      }
      // Note: not preventing default for wheel - trackpad scrolling feels natural
    }

    // All touch events need passive: false for manual scroll control
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: true })

    return () => {
      stopMomentum()
      if (gesture.rafId) cancelAnimationFrame(gesture.rafId)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchCancel)
      container.removeEventListener('wheel', handleWheel)
    }
  }, [view])

  // Load events for the visible date range
  useEffect(() => {
    let isSubscribed = true

    async function loadEvents() {
      if (!user) return

      try {
        // Calculate date range for the 63-day buffer (31 days before and after)
        const startDate = new Date(currentDate)
        startDate.setDate(startDate.getDate() - 35) // Extra buffer
        startDate.setHours(0, 0, 0, 0)

        const endDate = new Date(currentDate)
        endDate.setDate(endDate.getDate() + 35) // Extra buffer
        endDate.setHours(23, 59, 59, 999)

        const { events: userEvents } = await fetchExpandedEvents(user, session?.access_token, startDate, endDate)
        if (isSubscribed) {
          setEvents(userEvents || [])
        }
      } catch (error) {
        console.error('[MobileCalendar] Error loading events:', error)
      }
    }

    loadEvents()

    if (!user) return

    const channel = supabase
      .channel(`mobile-calendar-events-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          setTimeout(() => loadEvents(), 500)
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      channel.unsubscribe()
    }
  }, [user, session, currentDate])

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Measure container width for column sizing
  useEffect(() => {
    const updateColumnWidth = () => {
      if (scrollContainerRef.current) {
        const containerWidth = scrollContainerRef.current.clientWidth
        setColumnWidth((containerWidth - 40) / 3)
      }
    }

    // Initial measurement after mount
    const timer = setTimeout(updateColumnWidth, 50)

    // Update on resize
    window.addEventListener('resize', updateColumnWidth)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateColumnWidth)
    }
  }, [view])

  // Scroll to current time (vertical) and position days (horizontal for 3-day view)
  useEffect(() => {
    if (view !== 'day' && view !== '3day') return
    if (!scrollContainerRef.current) return

    // Use a small timeout + animation frames to ensure DOM is fully ready
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!scrollContainerRef.current) return

          // Measure and update columnWidth state
          const containerWidth = scrollContainerRef.current.clientWidth
          const newColumnWidth = (containerWidth - 40) / 3
          setColumnWidth(newColumnWidth)

          if (view === '3day') {
            // For 3-day view: single scroll container handles both directions
            // Horizontal: position currentDate at left-most column (index 31)
            const scrollToIndex = 31
            scrollContainerRef.current.scrollLeft = scrollToIndex * newColumnWidth

            // Vertical: scroll to current time (account for sticky header height of 28px)
            const now = new Date()
            const currentMinutes = now.getHours() * 60 + now.getMinutes()
            const headerHeight = 28
            const containerHeight = scrollContainerRef.current.clientHeight - headerHeight
            const totalHeight = 24 * 60
            const maxScroll = totalHeight - containerHeight
            const idealScroll = currentMinutes - (containerHeight / 3)
            scrollContainerRef.current.scrollTop = Math.max(0, Math.min(idealScroll, maxScroll))
          } else {
            // For day view: vertical scroll only
            const now = new Date()
            const currentMinutes = now.getHours() * 60 + now.getMinutes()
            const containerHeight = scrollContainerRef.current.clientHeight
            const totalHeight = 24 * 60
            const maxScroll = totalHeight - containerHeight
            const idealScroll = currentMinutes - (containerHeight / 3)
            scrollContainerRef.current.scrollTop = Math.max(0, Math.min(idealScroll, maxScroll))
          }
        })
      })
    }, 50)

    return () => clearTimeout(timer)
  }, [view, currentDate])

  // Handle scrollToDate prop - scroll to a specific date within the existing buffer
  useEffect(() => {
    if (!scrollToDate || view !== '3day' || !scrollContainerRef.current) return

    // Calculate days difference from buffer center (currentDate is at index 31)
    const scrollToTime = new Date(scrollToDate).setHours(0, 0, 0, 0)
    const currentTime = new Date(currentDate).setHours(0, 0, 0, 0)
    const daysDiff = Math.round((scrollToTime - currentTime) / (1000 * 60 * 60 * 24))

    // Check if the target date is within the buffer (±31 days)
    if (Math.abs(daysDiff) <= 31) {
      // Target date index = 31 (center) + daysDiff
      const targetIndex = 31 + daysDiff

      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return
        const containerWidth = scrollContainerRef.current.clientWidth
        const colWidth = (containerWidth - 40) / 3

        // Instant scroll to position this date at the left-most column
        scrollContainerRef.current.scrollLeft = targetIndex * colWidth

        // Update display date
        if (onDisplayDateChange) {
          onDisplayDateChange(scrollToDate)
        }
      })
    }
  }, [scrollToDate, view, currentDate, onDisplayDateChange])

  const handleDayClick = (date: Date) => {
    onDateChange(date)
  }

  const formatTime = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour} ${ampm}`
  }

  const handleUpdateEvent = async (eventId: string, updates: Partial<CalendarEvent>, optimistic = false) => {
    if (!user || !session) return

    // Optimistic update: apply changes immediately to prevent visual snap-back
    if (optimistic) {
      setEvents(prevEvents =>
        prevEvents.map(e => (e.id === eventId ? { ...e, ...updates } : e))
      )
    }

    try {
      const { event: updatedEvent } = await updateEvent(user, eventId, updates, session.access_token)
      // Only update state from server response if not already optimistically updated
      if (updatedEvent && !optimistic) {
        setEvents(prevEvents =>
          prevEvents.map(e => (e.id === eventId ? { ...e, ...updates } : e))
        )
      }
    } catch (error) {
      console.error('Error updating event:', error)
      // Rollback optimistic update on error by reloading events
      if (optimistic) {
        const { events: userEvents } = await fetchExpandedEvents(user, session.access_token)
        setEvents(userEvents || [])
      }
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!user || !session) return

    try {
      const { success } = await deleteEvent(user, eventId, session.access_token)
      if (success) {
        setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId))
      }
    } catch (error) {
      console.error('Error deleting event:', error)
    }
  }

  const handleCreateEvent = async (eventData: Partial<CalendarEvent>) => {
    if (!user || !session) return

    try {
      const { event: newEvent } = await createEvent(user, eventData as any, session.access_token)
      if (newEvent) {
        setEvents(prevEvents => [...prevEvents, newEvent])
      }
    } catch (error) {
      console.error('Error creating event:', error)
    }
  }

  const handleDeleteRecurringEvent = async (event: CalendarEvent, deleteOption: 'this_instance' | 'entire_series') => {
    if (!user || !session) return

    try {
      const { success } = await deleteRecurringEvent(user, event.id, deleteOption, session.access_token)
      if (success) {
        const { events: userEvents } = await fetchExpandedEvents(user, session.access_token)
        setEvents(userEvents || [])
      }
    } catch (error) {
      console.error('Error deleting recurring event:', error)
    }
  }

  // Handle tap on time slot to create event
  const handleTimeSlotTap = (hour: number) => {
    const startTime = new Date(currentDate)
    startTime.setHours(hour, 0, 0, 0)

    const endTime = new Date(startTime)
    endTime.setHours(hour + 1, 0, 0, 0)

    const newEventTemplate: Partial<CalendarEvent> = {
      title: '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    }

    setSelectedEvent(newEventTemplate as CalendarEvent)
    setIsFormOpen(true)
  }

  // Event touch handlers - ORIGINAL WORKFLOW:
  // Quick tap = open event
  // Hold 400ms = enter edit mode (can drag while holding)
  const handleEventTouchStart = (event: CalendarEvent, clientY: number, clientX: number, dayIndex?: number) => {
    if (eventTouchTimer) clearTimeout(eventTouchTimer)

    touchedEventRef.current = event
    touchStartPosRef.current = { x: clientX, y: clientY }
    hasMovedRef.current = false
    isInEditModeRef.current = false
    isDraggingRef.current = false
    draggingEventRef.current = null
    dragStartYRef.current = clientY
    dragCurrentYRef.current = clientY
    touchStartTimeRef.current = Date.now()

    // Cross-day drag setup (for 3-day view)
    // Store the actual column index (0-62) for the event being dragged
    if (view === '3day' && dayIndex !== undefined) {
      dragStartXRef.current = clientX
      dragCurrentXRef.current = clientX
      sourceDayIndexRef.current = dayIndex  // Store actual column index
      targetDayIndexRef.current = dayIndex
      setDragStartX(clientX)
      setDragCurrentX(clientX)
      setSourceDayIndex(dayIndex)
      setTargetDayIndex(dayIndex)
    }

    setTouchedEvent(event)
    setIsInEditMode(false)
    setIsDragging(false)

    // After 400ms, enter edit mode (enable dragging while holding)
    const timer = setTimeout(() => {
      isInEditModeRef.current = true
      setIsInEditMode(true)
      setEventTouchTimer(null)

      // Cancel any partially buffered scroll gesture (including pending rAF)
      if (scrollGestureRef.current.rafId) {
        cancelAnimationFrame(scrollGestureRef.current.rafId)
        scrollGestureRef.current.rafId = null
      }
      scrollGestureRef.current.phase = 'idle'
    }, 400)
    setEventTouchTimer(timer)
  }

  const handleEventTouchMove = (clientY: number, clientX: number) => {
    if (!touchedEventRef.current || !touchStartPosRef.current) return

    const deltaX = Math.abs(clientX - touchStartPosRef.current.x)
    const deltaY = Math.abs(clientY - touchStartPosRef.current.y)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance > 10) {
      hasMovedRef.current = true

      if (isInEditModeRef.current) {
        // In edit mode - start/continue dragging
        if (!isDraggingRef.current) {
          isDraggingRef.current = true
          draggingEventRef.current = touchedEventRef.current
          dragStartYRef.current = touchStartPosRef.current.y
          setIsDragging(true)
          setDraggingEvent(touchedEventRef.current)
          setDragStartY(touchStartPosRef.current.y)
        }
        dragCurrentYRef.current = clientY
        setDragCurrentY(clientY)

        // Cross-day tracking (for 3-day view)
        if (view === '3day') {
          dragCurrentXRef.current = clientX
          setDragCurrentX(clientX)

          // Calculate which column the finger is over using scroll position
          const newTargetDay = getColumnIndexFromX(clientX)

          if (newTargetDay !== null && newTargetDay !== targetDayIndexRef.current) {
            targetDayIndexRef.current = newTargetDay
            setTargetDayIndex(newTargetDay)
            // Haptic feedback on day change
            if (navigator.vibrate) {
              navigator.vibrate(10)
            }
          }
        }
      } else {
        // Movement before edit mode - cancel (user is scrolling)
        if (eventTouchTimer) {
          clearTimeout(eventTouchTimer)
          setEventTouchTimer(null)
        }
        setTouchedEvent(null)
        touchedEventRef.current = null
      }
    }
  }

  const handleEventTouchEnd = () => {
    const touchDuration = Date.now() - touchStartTimeRef.current

    if (eventTouchTimer) {
      clearTimeout(eventTouchTimer)
      setEventTouchTimer(null)
    }

    // Capture drag data before resetting state
    let pendingUpdate: { eventId: string; startTime: string; endTime: string } | null = null

    // If dragging, prepare the update
    if (isDraggingRef.current && draggingEventRef.current) {
      const deltaY = dragCurrentYRef.current - dragStartYRef.current
      const rawDeltaMinutes = deltaY

      // Check if the event was dragged to a different day
      const didChangeDays = view === '3day' &&
        targetDayIndexRef.current !== null &&
        sourceDayIndexRef.current !== null &&
        targetDayIndexRef.current !== sourceDayIndexRef.current

      if (Math.abs(rawDeltaMinutes) >= 10 || didChangeDays) {
        const originalStart = new Date(draggingEventRef.current.start_time)
        const originalEnd = new Date(draggingEventRef.current.end_time)
        const duration = originalEnd.getTime() - originalStart.getTime()

        const newStartRaw = new Date(originalStart.getTime() + rawDeltaMinutes * 60 * 1000)
        const snappedMinutes = Math.round(newStartRaw.getMinutes() / 15) * 15
        const newStart = new Date(newStartRaw)
        newStart.setMinutes(snappedMinutes, 0, 0)

        // If cross-day drag, update the date using the target column index
        if (didChangeDays && targetDayIndexRef.current !== null) {
          const targetDate = getDateForColumnIndex(targetDayIndexRef.current)
          newStart.setFullYear(targetDate.getFullYear())
          newStart.setMonth(targetDate.getMonth())
          newStart.setDate(targetDate.getDate())
        }

        const newEnd = new Date(newStart.getTime() + duration)

        pendingUpdate = {
          eventId: draggingEventRef.current.id,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString()
        }
      }
    } else if (!hasMovedRef.current && touchDuration < 200 && touchedEventRef.current) {
      // Quick tap - open event form
      const event = touchedEventRef.current
      if (event.is_recurring || event.parent_event_id) {
        setRecurringEventToView(event)
        setIsRecurringViewOpen(true)
      } else {
        setSelectedEvent(event)
        setIsFormOpen(true)
      }
    }

    // Reset all state IMMEDIATELY (before async update)
    touchedEventRef.current = null
    isInEditModeRef.current = false
    isDraggingRef.current = false
    draggingEventRef.current = null
    dragStartYRef.current = 0
    dragCurrentYRef.current = 0
    touchStartPosRef.current = null
    hasMovedRef.current = false

    // Reset cross-day state
    dragStartXRef.current = 0
    dragCurrentXRef.current = 0
    targetDayIndexRef.current = null
    sourceDayIndexRef.current = null

    // Reset scroll gesture state to ensure scrolling works after event drag
    if (scrollGestureRef.current.momentumRafId) {
      cancelAnimationFrame(scrollGestureRef.current.momentumRafId)
      scrollGestureRef.current.momentumRafId = null
    }
    if (scrollGestureRef.current.rafId) {
      cancelAnimationFrame(scrollGestureRef.current.rafId)
      scrollGestureRef.current.rafId = null
    }
    scrollGestureRef.current.phase = 'idle'
    scrollGestureRef.current.direction = null
    scrollGestureRef.current.velocityX = 0
    scrollGestureRef.current.velocityY = 0

    setTouchedEvent(null)
    setIsInEditMode(false)
    setIsDragging(false)
    setDraggingEvent(null)
    setDragStartY(0)
    setDragCurrentY(0)
    setDragStartX(0)
    setDragCurrentX(0)
    setTargetDayIndex(null)
    setSourceDayIndex(null)

    // Perform the update AFTER state reset with optimistic update to prevent snap-back
    if (pendingUpdate) {
      handleUpdateEvent(pendingUpdate.eventId, {
        start_time: pendingUpdate.startTime,
        end_time: pendingUpdate.endTime
      }, true)  // optimistic = true
    }
  }

  return (
    <div className="mobile-calendar" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {view === 'month' ? (
        // Month View
        <div ref={scrollContainerRef} style={{ flex: 1, overflow: hideMonthDayHeaders ? 'visible' : 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: hideMonthDayHeaders ? 'repeat(6, 1fr)' : 'auto repeat(6, 1fr)',
            minHeight: hideMonthDayHeaders ? 'auto' : '100%'
          }}>
            {!hideMonthDayHeaders && ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index} style={{
                padding: '4px 2px',
                textAlign: 'center',
                fontSize: '10px',
                fontWeight: '500',
                color: colors.textTertiary,
                textTransform: 'uppercase'
              }}>
                {day}
              </div>
            ))}
            {getMonthDates(currentDate).map((date, idx) => {
              const dateIso = date.toISOString()
              const isToday = date.toDateString() === new Date().toDateString()
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const dayEvents = getEventsForDate(date)
              const col = idx % 7
              const row = Math.floor(idx / 7)

              return (
                <div
                  key={dateIso}
                  data-date={dateIso}
                  onClick={(e) => {
                    // Read date from data attribute to ensure correct date is used
                    const isoString = e.currentTarget.getAttribute('data-date')
                    if (isoString) {
                      handleDayClick(new Date(isoString))
                    }
                  }}
                  style={{
                    padding: '6px',
                    color: isCurrentMonth ? colors.textPrimary : colors.textTertiary,
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '70px',
                    overflow: 'hidden',
                    borderTop: row === 0 ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` : 'none',
                    borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    borderRight: col < 6 ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` : 'none'
                  }}
                >
                  <div style={{
                    fontSize: '12px',
                    fontWeight: isToday ? '600' : '400',
                    color: isToday ? (isDarkMode ? '#2a2a2a' : '#fff') : 'inherit',
                    background: isToday ? (isDarkMode ? '#d0d0d0' : '#000') : 'transparent',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '4px',
                    flexShrink: 0
                  }}>
                    {date.getDate()}
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    overflow: 'hidden',
                    flex: 1
                  }}>
                    {dayEvents.slice(0, 2).map((event) => {
                      const eventColor = getEventColor(event)
                      return (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (event.is_recurring || event.parent_event_id) {
                              setRecurringEventToView(event)
                              setIsRecurringViewOpen(true)
                            } else {
                              setSelectedEvent(event)
                              setIsFormOpen(true)
                            }
                          }}
                          style={{
                            background: hexToRgba(eventColor, 0.12),
                            borderLeft: `2px solid ${eventColor}`,
                            color: colors.textPrimary,
                            fontSize: '9px',
                            padding: '2px 3px',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          {event.title}
                          {getRecurrenceBadge(event) && <span style={{ marginLeft: '2px', fontSize: '8px' }}>♻️</span>}
                        </div>
                      )
                    })}
                    {dayEvents.length > 2 && (
                      <div style={{
                        fontSize: '8px',
                        color: colors.textSecondary,
                        padding: '1px 3px',
                        fontWeight: '500'
                      }}>
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : view === '3day' ? (
        // 3-Day View with continuous horizontal scrolling
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Single scroll container for both horizontal and vertical */}
          {/* touch-action: none disables native touch scrolling - we handle it manually */}
          <div
            ref={scrollContainerRef}
            onScroll={handleHorizontalScroll}
            style={{
              flex: 1,
              overflow: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              touchAction: 'none',  // Disable native touch scrolling - manual control
              overscrollBehavior: 'none'  // Prevent pull-to-refresh and edge bounces
            }}
          >
            <div style={{ display: 'flex', width: `${63 * columnWidth + 40}px` }}>
              {/* Time gutter column - sticky left */}
              <div style={{
                width: '40px',
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                zIndex: 20,
                background: colors.bgPrimary
              }}>
                {/* Timezone header - sticky top */}
                <div style={{
                  position: 'sticky',
                  top: 0,
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '400',
                  color: colors.textTertiary,
                  background: colors.bgPrimary,
                  zIndex: 30,
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  {new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()}
                </div>
                {/* Hour labels - marginTop matches sticky header height so 12am is visible */}
                <div style={{ position: 'relative', height: `${24 * 60}px`, marginTop: '28px' }}>
                  {hours.map(hour => (
                    <div
                      key={hour}
                      style={{
                        height: '60px',
                        position: 'relative'
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        transform: 'translateY(-50%)',
                        fontSize: '9px',
                        color: colors.textTertiary,
                        background: colors.bgPrimary,
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                      }}>
                        {formatTime(hour)}
                      </span>
                    </div>
                  ))}
                  {/* Current time label in time gutter */}
                  <div style={{
                    position: 'absolute',
                    top: `${currentTime.getHours() * 60 + currentTime.getMinutes()}px`,
                    left: 0,
                    right: 0,
                    transform: 'translateY(-50%)',
                    zIndex: 20,
                    textAlign: 'center'
                  }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: '600',
                      color: '#ef4444',
                      background: colors.bgPrimary,
                      whiteSpace: 'nowrap'
                    }}>
                      {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Day columns */}
              {getVisibleDays(currentDate, 63).map((date, dayIndex) => {
                const dayEvents = getEventsForDate(date)
                const dayWidth = `${columnWidth}px`
                const todayDate = isToday(date)

                return (
                  <div
                    key={date.toISOString()}
                    style={{
                      width: dayWidth,
                      minWidth: dayWidth,
                      flexShrink: 0,
                      position: 'relative'
                    }}
                  >
                    {/* Day header - sticky top */}
                    <div style={{
                      position: 'sticky',
                      top: 0,
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: '400',
                      color: todayDate ? '#ef4444' : colors.textPrimary,
                      background: colors.bgPrimary,
                      zIndex: 10,
                      borderBottom: `1px solid ${colors.border}`
                    }}>
                      <span style={{ textTransform: 'uppercase' }}>
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]}
                      </span>
                      <span>{date.getDate()}</span>
                    </div>
                    {/* Day content - marginTop matches sticky header height so 12am is visible */}
                    <div style={{
                      position: 'relative',
                      height: `${24 * 60}px`,
                      marginTop: '28px',
                      background: isDragging && dayIndex >= 31 && dayIndex < 34 && targetDayIndex === (dayIndex - 31)
                        ? (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)')
                        : 'transparent'
                    }}>
                      {/* Continuous red time line */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${currentTime.getHours() * 60 + currentTime.getMinutes()}px`,
                        height: '2px',
                        background: '#ef4444',
                        zIndex: 10,
                        pointerEvents: 'none'
                      }} />
                  {/* Hour grid lines */}
                  {hours.map(hour => (
                    <div
                      key={hour}
                      onClick={() => {
                        // Create event on this day at this hour
                        const startTime = new Date(date)
                        startTime.setHours(hour, 0, 0, 0)
                        const endTime = new Date(startTime)
                        endTime.setHours(hour + 1, 0, 0, 0)
                        const newEventTemplate: Partial<CalendarEvent> = {
                          title: '',
                          start_time: startTime.toISOString(),
                          end_time: endTime.toISOString()
                        }
                        setSelectedEvent(newEventTemplate as CalendarEvent)
                        setIsFormOpen(true)
                      }}
                      style={{
                        height: '60px',
                        borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        cursor: 'pointer'
                      }}
                    />
                  ))}

                  {/* 15-minute grid lines in edit mode */}
                  {isInEditMode && hours.map(hour => (
                    <div key={`grid-${hour}`}>
                      {[15, 30, 45].map(minute => (
                        <div
                          key={`grid-${hour}-${minute}`}
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: `${hour * 60 + minute}px`,
                            height: '1px',
                            background: isDarkMode
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.06)',
                            pointerEvents: 'none',
                            zIndex: 1
                          }}
                        />
                      ))}
                    </div>
                  ))}

                  {/* Vertical day separator lines in edit mode */}
                  {isInEditMode && dayIndex > 31 && dayIndex < 34 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '1px',
                        background: isDarkMode
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                        pointerEvents: 'none',
                        zIndex: 1
                      }}
                    />
                  )}

                  {/* Events for this day */}
                  {dayEvents.map((event) => {
                    const startTime = new Date(event.start_time)
                    const endTime = new Date(event.end_time)
                    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes()
                    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
                    const eventColor = getEventColor(event)
                    const isBeingDragged = isDragging && draggingEvent?.id === event.id

                    // Calculate drag offset (vertical and horizontal)
                    let dragOffset = 0
                    let horizontalOffset = 0
                    let showInThisColumn = true
                    // Convert dayIndex to rect index for comparison (only for visible columns 31, 32, 33)
                    const rectIndex = dayIndex >= 31 && dayIndex < 34 ? dayIndex - 31 : -1
                    if (isBeingDragged) {
                      // Vertical offset (snap to 15-minute intervals)
                      const rawDragOffset = dragCurrentY - dragStartY
                      const newMinutesRaw = startMinutes + rawDragOffset
                      const snappedMinutes = Math.round(newMinutesRaw / 15) * 15
                      dragOffset = snappedMinutes - startMinutes

                      // Horizontal offset: calculate which column the event should snap to
                      // Event appears in the source column but translates horizontally to follow finger
                      if (targetDayIndex !== null && sourceDayIndex !== null) {
                        // Calculate column difference between target and current event's column
                        const sourceColIndex = sourceDayIndex - 31  // Convert to 0-2 range
                        const targetColIndex = targetDayIndex - 31  // Convert to 0-2 range

                        // Only show in source column, with horizontal transform applied
                        if (sourceColIndex !== rectIndex) {
                          showInThisColumn = false
                        } else {
                          // Calculate horizontal pixel offset to move event to target column
                          horizontalOffset = (targetColIndex - sourceColIndex) * columnWidth
                        }
                      }
                    }

                    // Ghost preview no longer needed - event follows finger directly
                    if (!showInThisColumn) return null

                    return (
                      <div
                        key={event.id}
                        className="calendar-event"
                        onTouchStart={(e) => {
                          e.stopPropagation()
                          const touch = e.touches[0]
                          if (touch) {
                            handleEventTouchStart(event, touch.clientY, touch.clientX, dayIndex)
                          }
                        }}
                        onTouchMove={(e) => {
                          const touch = e.touches[0]
                          if (touch) {
                            handleEventTouchMove(touch.clientY, touch.clientX)
                            if (isDragging) {
                              e.preventDefault()
                            }
                          }
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation()
                          handleEventTouchEnd()
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isDragging) {
                            if (event.is_recurring || event.parent_event_id) {
                              setRecurringEventToView(event)
                              setIsRecurringViewOpen(true)
                            } else {
                              setSelectedEvent(event)
                              setIsFormOpen(true)
                            }
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: '4px',
                          right: '4px',
                          top: `${startMinutes + dragOffset}px`,
                          height: `${Math.max(duration, 15)}px`,
                          background: hexToRgba(eventColor, isBeingDragged ? 0.35 : 0.25),
                          borderLeft: `3px solid ${eventColor}`,
                          borderRadius: '4px',
                          padding: '2px 4px',
                          cursor: isDragging ? 'grabbing' : 'pointer',
                          overflow: 'hidden',
                          zIndex: isBeingDragged ? 100 : 5,
                          opacity: isBeingDragged ? 0.8 : 1,
                          transition: isBeingDragged ? 'none' : 'all 0.2s',
                          touchAction: 'none',
                          // Apply horizontal transform when dragging across days
                          transform: isBeingDragged && horizontalOffset !== 0
                            ? `translateX(${horizontalOffset}px)`
                            : undefined,
                          ...(touchedEvent?.id === event.id && isInEditMode && {
                            boxShadow: isDarkMode
                              ? '0 0 0 2px rgba(255, 255, 255, 0.5), 0 0 0 6px rgba(96, 165, 250, 0.6)'
                              : '0 0 0 2px rgba(0, 0, 0, 0.6), 0 0 0 6px rgba(59, 130, 246, 0.5)',
                            animation: isDarkMode
                              ? 'eventPulseDark 1s ease-in-out infinite'
                              : 'eventPulse 1s ease-in-out infinite'
                          })
                        }}
                      >
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: eventColor,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {event.title}
                          {getRecurrenceBadge(event) && <span style={{ marginLeft: '2px' }}>♻️</span>}
                        </div>
                        {duration >= 30 && (
                          <div style={{
                            fontSize: '9px',
                            color: eventColor,
                            opacity: 0.8,
                            marginTop: '1px'
                          }}>
                            {startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        // Day View
        <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', position: 'relative', paddingTop: '8px', paddingBottom: '8px' }}>
          <div style={{ position: 'relative', minHeight: `${24 * 60}px` }}>
            {/* Hour rows */}
            {hours.map(hour => (
              <div
                key={hour}
                onClick={() => handleTimeSlotTap(hour)}
                style={{
                  height: '60px',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  transform: 'translateY(-50%)'
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    width: '50px',
                    textAlign: 'right',
                    paddingRight: '8px',
                    flexShrink: 0,
                    background: colors.bgPrimary
                  }}>
                    {formatTime(hour)}
                  </span>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    background: colors.border
                  }} />
                </div>
              </div>
            ))}

            {/* Bottom 12 AM line */}
            <div style={{
              position: 'absolute',
              top: `${24 * 60}px`,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              transform: 'translateY(-50%)'
            }}>
              <span style={{
                fontSize: '11px',
                color: colors.textTertiary,
                width: '50px',
                textAlign: 'right',
                paddingRight: '8px',
                flexShrink: 0,
                background: colors.bgPrimary
              }}>
                {formatTime(0)}
              </span>
              <div style={{
                flex: 1,
                height: '1px',
                background: colors.border
              }} />
            </div>

            {/* 15-minute grid lines - shown in edit mode */}
            {isInEditMode && hours.map(hour => (
              <div key={`grid-container-${hour}`}>
                {[15, 30, 45].map(minute => (
                  <div
                    key={`grid-${hour}-${minute}`}
                    style={{
                      position: 'absolute',
                      left: '58px',
                      right: 0,
                      top: `${hour * 60 + minute}px`,
                      height: '1px',
                      background: isDarkMode
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)',
                      pointerEvents: 'none',
                      zIndex: 1
                    }}
                  />
                ))}
              </div>
            ))}

            {/* Current time indicator */}
            {currentDate.toDateString() === new Date().toDateString() && (
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(currentTime.getHours() * 60 + currentTime.getMinutes())}px`,
                zIndex: 10,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center'
              }}>
                <div style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginLeft: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
                <div style={{
                  flex: 1,
                  height: '2px',
                  background: '#ef4444'
                }} />
              </div>
            )}

            {/* Events */}
            {getEventsForDate(currentDate).map((event) => {
              const startTime = new Date(event.start_time)
              const endTime = new Date(event.end_time)
              const startMinutes = startTime.getHours() * 60 + startTime.getMinutes()
              const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
              const eventColor = getEventColor(event)
              const isBeingDragged = isDragging && draggingEvent?.id === event.id

              let dragOffset = 0
              if (isBeingDragged) {
                const rawDragOffset = dragCurrentY - dragStartY
                const newMinutesRaw = startMinutes + rawDragOffset
                const snappedMinutes = Math.round(newMinutesRaw / 15) * 15
                dragOffset = snappedMinutes - startMinutes
              }

              return (
                <div
                  key={event.id}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const touch = e.touches[0]
                    if (touch) {
                      handleEventTouchStart(event, touch.clientY, touch.clientX)
                    }
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0]
                    if (touch) {
                      handleEventTouchMove(touch.clientY, touch.clientX)
                      if (isDragging) {
                        e.preventDefault()
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation()
                    handleEventTouchEnd()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isDragging) {
                      if (event.is_recurring || event.parent_event_id) {
                        setRecurringEventToView(event)
                        setIsRecurringViewOpen(true)
                      } else {
                        setSelectedEvent(event)
                        setIsFormOpen(true)
                      }
                    }
                  }}
                  className="calendar-event"
                  style={{
                    position: 'absolute',
                    left: '58px',
                    right: '8px',
                    top: `${startMinutes + dragOffset}px`,
                    height: `${Math.max(duration, 15)}px`,
                    background: hexToRgba(eventColor, isBeingDragged ? 0.35 : 0.25),
                    borderLeft: `3px solid ${eventColor}`,
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    overflow: 'hidden',
                    zIndex: isBeingDragged ? 100 : 5,
                    opacity: isBeingDragged ? 0.8 : 1,
                    transition: isBeingDragged ? 'none' : 'all 0.2s',
                    touchAction: 'none',
                    ...(touchedEvent?.id === event.id && isInEditMode && {
                      boxShadow: isDarkMode
                        ? '0 0 0 2px rgba(255, 255, 255, 0.5), 0 0 0 8px rgba(96, 165, 250, 0.6)'
                        : '0 0 0 2px rgba(0, 0, 0, 0.6), 0 0 0 8px rgba(59, 130, 246, 0.5)',
                      animation: isDarkMode
                        ? 'eventPulseDark 1s ease-in-out infinite'
                        : 'eventPulse 1s ease-in-out infinite'
                    })
                  }}
                >
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: eventColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {event.title}
                    {getRecurrenceBadge(event) && <span style={{ marginLeft: '4px' }}>♻️</span>}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: eventColor,
                    opacity: 0.8,
                    marginTop: '2px'
                  }}>
                    {startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Event Form Modal */}
      {isFormOpen && (
        isMobile ? (
          <EventFormMobile
            event={selectedEvent}
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false)
              setSelectedEvent(null)
            }}
            onSave={async (eventData) => {
              if (selectedEvent?.id) {
                await handleUpdateEvent(selectedEvent.id, eventData)
              } else {
                await handleCreateEvent(eventData)
              }
              setIsFormOpen(false)
              setSelectedEvent(null)
            }}
            onDelete={async () => {
              if (selectedEvent?.id) {
                await handleDeleteEvent(selectedEvent.id)
                setIsFormOpen(false)
                setSelectedEvent(null)
              }
            }}
          />
        ) : (
          <EventForm
            event={selectedEvent}
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false)
              setSelectedEvent(null)
            }}
            onSave={async (eventData) => {
              if (selectedEvent?.id) {
                await handleUpdateEvent(selectedEvent.id, eventData)
              } else {
                await handleCreateEvent(eventData)
              }
              setIsFormOpen(false)
              setSelectedEvent(null)
            }}
            onDelete={async () => {
              if (selectedEvent?.id) {
                await handleDeleteEvent(selectedEvent.id)
                setIsFormOpen(false)
                setSelectedEvent(null)
              }
            }}
          />
        )
      )}

      {/* Recurring Event View Modal */}
      {isRecurringViewOpen && recurringEventToView && (
        <RecurringEventView
          event={recurringEventToView}
          isOpen={isRecurringViewOpen}
          onClose={() => {
            setIsRecurringViewOpen(false)
            setRecurringEventToView(null)
          }}
          onEdit={(event, _scope) => {
            setRecurringEventToEdit(event)
            setIsRecurringEditOpen(true)
            setIsRecurringViewOpen(false)
          }}
          onDelete={async (event, scope) => {
            await handleDeleteRecurringEvent(event, scope)
            setIsRecurringViewOpen(false)
            setRecurringEventToView(null)
          }}
        />
      )}

      {/* Recurring Event Edit Modal */}
      {isRecurringEditOpen && recurringEventToEdit && user && session && (
        <EditRecurringEventModal
          event={recurringEventToEdit}
          isOpen={isRecurringEditOpen}
          user={user}
          accessToken={session.access_token}
          onClose={() => {
            setIsRecurringEditOpen(false)
            setRecurringEventToEdit(null)
          }}
          onSuccess={async () => {
            const { events: userEvents } = await fetchExpandedEvents(user, session.access_token)
            setEvents(userEvents || [])
            setIsRecurringEditOpen(false)
            setRecurringEventToEdit(null)
          }}
        />
      )}
    </div>
  )
}
