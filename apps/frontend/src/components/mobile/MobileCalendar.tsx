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

type MobileViewType = 'day' | 'month'

interface MobileCalendarProps {
  view: MobileViewType
  currentDate: Date
  onDateChange: (date: Date) => void
}

export function MobileCalendar({ view, currentDate, onDateChange }: MobileCalendarProps) {
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

  // Recurring event view state
  const [recurringEventToView, setRecurringEventToView] = useState<CalendarEvent | null>(null)
  const [isRecurringViewOpen, setIsRecurringViewOpen] = useState(false)

  // Recurring event edit state
  const [recurringEventToEdit, setRecurringEventToEdit] = useState<CalendarEvent | null>(null)
  const [isRecurringEditOpen, setIsRecurringEditOpen] = useState(false)

  // Tap state for creating events on time slots
  const [isDragging, setIsDragging] = useState(false)
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragStartY, setDragStartY] = useState<number>(0)
  const [dragCurrentY, setDragCurrentY] = useState<number>(0)

  // Multi-stage touch interaction state for events
  const [eventTouchTimer, setEventTouchTimer] = useState<NodeJS.Timeout | null>(null)
  const [eventPreviewTimer, setEventPreviewTimer] = useState<NodeJS.Timeout | null>(null)
  const [touchedEvent, setTouchedEvent] = useState<CalendarEvent | null>(null)
  const [isInPreviewMode, setIsInPreviewMode] = useState(false)
  const [isInEditMode, setIsInEditMode] = useState(false)
  const [touchStartTime, setTouchStartTime] = useState<number>(0)
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null)
  const [hasMoved, setHasMoved] = useState(false)

  // Refs for touch handlers (avoids React stale closure bug)
  const isInEditModeRef = useRef(false)
  const isDraggingRef = useRef(false)
  const draggingEventRef = useRef<CalendarEvent | null>(null)
  const dragStartYRef = useRef(0)
  const dragCurrentYRef = useRef(0)
  const touchedEventRef = useRef<CalendarEvent | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)

  // Refs for time slot tap detection (for creating new events)
  const timeSlotTouchStartRef = useRef<{ hour: number; x: number; y: number; time: number } | null>(null)
  const timeSlotHasMovedRef = useRef(false)

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

    // Add previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      dates.push(prevDate)
    }

    // Add current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i))
    }

    // Add next month days to complete 6 weeks (42 days total)
    const totalDays = 42
    for (let i = 1; dates.length < totalDays; i++) {
      dates.push(new Date(year, month + 1, i))
    }

    return dates
  }

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateStr = date.toDateString()
    return events.filter(event => {
      const eventDate = new Date(event.start_time)
      return eventDate.toDateString() === dateStr
    })
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Load events and set up real-time subscription
  useEffect(() => {
    let isSubscribed = true

    async function loadEvents() {
      if (!user) return

      try {
        const { events: userEvents } = await fetchExpandedEvents(user, session?.access_token)
        if (isSubscribed) {
          setEvents(userEvents || [])
        }
      } catch (error) {
        console.error('[MobileCalendar] Error loading events:', error)
      }
    }

    loadEvents()

    // Set up real-time subscription
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
  }, [user, session])

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Scroll to current time in day view
  useEffect(() => {
    if (view === 'day' && scrollContainerRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const now = new Date()
          const currentMinutes = now.getHours() * 60 + now.getMinutes()
          const containerHeight = scrollContainerRef.current.clientHeight
          const totalHeight = 24 * 60 // Total scrollable height (24 hours * 60px)
          const maxScroll = totalHeight - containerHeight

          // Try to position current time in upper third, but clamp to valid range
          const idealScroll = currentMinutes - (containerHeight / 3)
          const scrollPosition = Math.max(0, Math.min(idealScroll, maxScroll))
          scrollContainerRef.current.scrollTop = scrollPosition
        }
      }, 100)
    }
  }, [view, currentDate])

  // Handle clicking a day in month view
  const handleDayClick = (date: Date) => {
    onDateChange(date)
  }

  const formatTime = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour} ${ampm}`
  }

  // Handle event operations
  const handleUpdateEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
    if (!user || !session) return

    try {
      const { event: updatedEvent } = await updateEvent(user, eventId, updates, session.access_token)
      if (updatedEvent) {
        setEvents(prevEvents =>
          prevEvents.map(e => (e.id === eventId ? { ...e, ...updates } : e))
        )
      }
    } catch (error) {
      console.error('Error updating event:', error)
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
        // Refresh events after deletion
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

    // Create a new event template
    const newEventTemplate: Partial<CalendarEvent> = {
      title: '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    }

    setSelectedEvent(newEventTemplate as CalendarEvent)
    setIsFormOpen(true)
  }

  // Time slot touch handlers (tap to create event, like tapping existing events)
  const handleTimeSlotTouchStart = (hour: number, clientX: number, clientY: number) => {
    timeSlotTouchStartRef.current = { hour, x: clientX, y: clientY, time: Date.now() }
    timeSlotHasMovedRef.current = false
  }

  const handleTimeSlotTouchMove = (clientX: number, clientY: number) => {
    if (!timeSlotTouchStartRef.current) return

    const deltaX = Math.abs(clientX - timeSlotTouchStartRef.current.x)
    const deltaY = Math.abs(clientY - timeSlotTouchStartRef.current.y)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // If moved more than 10px, consider it scrolling
    if (distance > 10) {
      timeSlotHasMovedRef.current = true
    }
  }

  const handleTimeSlotTouchEnd = () => {
    if (!timeSlotTouchStartRef.current) return

    const touchDuration = Date.now() - timeSlotTouchStartRef.current.time
    const hour = timeSlotTouchStartRef.current.hour

    // Quick tap (< 200ms) without movement = create event
    if (!timeSlotHasMovedRef.current && touchDuration < 200) {
      handleTimeSlotTap(hour)
    }

    // Reset
    timeSlotTouchStartRef.current = null
    timeSlotHasMovedRef.current = false
  }

  // Multi-stage touch handlers for events
  const handleEventTouchStart = (event: CalendarEvent, clientY: number, clientX: number) => {
    // Clear any existing timers
    if (eventTouchTimer) clearTimeout(eventTouchTimer)
    if (eventPreviewTimer) clearTimeout(eventPreviewTimer)

    // Reset refs (avoids stale closure)
    touchedEventRef.current = event
    touchStartPosRef.current = { x: clientX, y: clientY }
    hasMovedRef.current = false
    isInEditModeRef.current = false
    isDraggingRef.current = false
    draggingEventRef.current = null
    dragStartYRef.current = 0
    dragCurrentYRef.current = 0

    // Reset UI state
    setTouchedEvent(event)
    setTouchStartTime(Date.now())
    setTouchStartPos({ x: clientX, y: clientY })
    setHasMoved(false)
    setIsInPreviewMode(false)
    setIsInEditMode(false)
    setIsDragging(false)

    // Stage 1: After 200ms, enter preview mode (visual feedback only)
    const previewTimer = setTimeout(() => {
      setIsInPreviewMode(true)
      setEventTouchTimer(null)
    }, 200)
    setEventTouchTimer(previewTimer)

    // Stage 2: After 400ms, enter edit mode (enable drag-and-drop)
    const editTimer = setTimeout(() => {
      console.log('[MobileCalendar] 400ms reached - EDIT MODE ENABLED')
      isInEditModeRef.current = true // Set ref for touch handlers!
      setIsInEditMode(true)
      setEventPreviewTimer(null)
    }, 400)
    setEventPreviewTimer(editTimer)
  }

  const handleEventTouchMove = (clientY: number, clientX: number) => {
    // Use refs to avoid stale closure!
    if (!touchedEventRef.current || !touchStartPosRef.current) return

    const deltaX = Math.abs(clientX - touchStartPosRef.current.x)
    const deltaY = Math.abs(clientY - touchStartPosRef.current.y)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // If moved more than 10px, consider it a drag
    if (distance > 10) {
      hasMovedRef.current = true
      setHasMoved(true)

      // Check ref, not state! (avoids stale closure)
      if (isInEditModeRef.current) {
        if (!isDraggingRef.current) {
          console.log('[MobileCalendar] Starting drag - edit mode active')
          isDraggingRef.current = true
          draggingEventRef.current = touchedEventRef.current
          dragStartYRef.current = touchStartPosRef.current.y
          setIsDragging(true)
          setDraggingEvent(touchedEventRef.current)
          setDragStartY(touchStartPosRef.current.y)
        }
        dragCurrentYRef.current = clientY
        setDragCurrentY(clientY)
      } else {
        // If dragging before edit mode, cancel all timers (user is scrolling)
        console.log('[MobileCalendar] Movement before edit mode - cancelling (hold 400ms first)')
        if (eventTouchTimer) {
          clearTimeout(eventTouchTimer)
          setEventTouchTimer(null)
        }
        if (eventPreviewTimer) {
          clearTimeout(eventPreviewTimer)
          setEventPreviewTimer(null)
        }
        setIsInPreviewMode(false)
        setTouchedEvent(null)
        touchedEventRef.current = null
      }
    }
  }

  const handleEventTouchEnd = async () => {
    const touchDuration = Date.now() - touchStartTime

    // Clear timers
    if (eventTouchTimer) {
      clearTimeout(eventTouchTimer)
      setEventTouchTimer(null)
    }
    if (eventPreviewTimer) {
      clearTimeout(eventPreviewTimer)
      setEventPreviewTimer(null)
    }

    // Use refs to avoid stale closure!
    if (isDraggingRef.current && draggingEventRef.current) {
      // Complete drag operation
      const deltaY = dragCurrentYRef.current - dragStartYRef.current

      // Calculate raw delta in minutes (1px = 1 minute)
      const rawDeltaMinutes = deltaY

      console.log('[MobileCalendar] Drag complete:', {
        deltaY,
        rawDeltaMinutes,
        eventId: draggingEventRef.current.id,
        eventTitle: draggingEventRef.current.title
      })

      if (Math.abs(rawDeltaMinutes) >= 10) { // Only update if moved at least 10 pixels
        const originalStart = new Date(draggingEventRef.current.start_time)
        const originalEnd = new Date(draggingEventRef.current.end_time)
        const duration = originalEnd.getTime() - originalStart.getTime()

        // Calculate new start time with raw delta
        const newStartRaw = new Date(originalStart.getTime() + rawDeltaMinutes * 60 * 1000)

        // Snap the NEW start time to nearest 15-minute boundary (:00, :15, :30, :45)
        const snappedMinutes = Math.round(newStartRaw.getMinutes() / 15) * 15
        const newStart = new Date(newStartRaw)
        newStart.setMinutes(snappedMinutes, 0, 0) // Also reset seconds and ms

        // Calculate new end time maintaining the same duration
        const newEnd = new Date(newStart.getTime() + duration)

        console.log('[MobileCalendar] Updating event times:', {
          originalStart: originalStart.toISOString(),
          newStartRaw: newStartRaw.toISOString(),
          snappedMinutes,
          newStart: newStart.toISOString(),
          newEnd: newEnd.toISOString()
        })

        await handleUpdateEvent(draggingEventRef.current.id, {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        })
      } else {
        console.log('[MobileCalendar] Drag too small, not updating (need >= 10 pixels)')
      }
    } else if (!hasMovedRef.current && touchDuration < 200 && touchedEventRef.current) {
      // Quick tap (< 200ms) - open event form
      const event = touchedEventRef.current
      if (event.is_recurring || event.parent_event_id) {
        setRecurringEventToView(event)
        setIsRecurringViewOpen(true)
      } else {
        setSelectedEvent(event)
        setIsFormOpen(true)
      }
    }
    // If 200ms-400ms or 400ms+, do nothing (just visual feedback)

    // Reset all refs
    touchedEventRef.current = null
    isInEditModeRef.current = false
    isDraggingRef.current = false
    draggingEventRef.current = null
    dragStartYRef.current = 0
    dragCurrentYRef.current = 0
    touchStartPosRef.current = null
    hasMovedRef.current = false

    // Reset UI state
    setTouchedEvent(null)
    setIsInPreviewMode(false)
    setIsInEditMode(false)
    setHasMoved(false)
    setTouchStartPos(null)
    setIsDragging(false)
    setDraggingEvent(null)
    setDragStartY(0)
    setDragCurrentY(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {view === 'month' ? (
        // Month View
        <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'auto repeat(6, 1fr)',
            gap: '2px',
            background: colors.border,
            minHeight: '100%',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {/* Week day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{
                padding: '6px 4px',
                textAlign: 'center',
                fontSize: '10px',
                fontWeight: '600',
                letterSpacing: '0.05em',
                color: colors.textSecondary,
                background: colors.bgSecondary,
                textTransform: 'uppercase'
              }}>
                {day}
              </div>
            ))}
            {/* Month dates */}
            {getMonthDates(currentDate).map((date, idx) => {
              const isToday = date.toDateString() === new Date().toDateString()
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const dayEvents = getEventsForDate(date)

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(date)}
                  style={{
                    padding: '8px',
                    background: colors.bgSecondary,
                    color: isCurrentMonth ? colors.textPrimary : colors.textTertiary,
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '80px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Date number */}
                  <div style={{
                    fontSize: '14px',
                    fontWeight: isToday ? '700' : '600',
                    color: isToday ? (isDarkMode ? '#2a2a2a' : '#fff') : 'inherit',
                    background: isToday ? (isDarkMode ? '#d0d0d0' : '#000') : 'transparent',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '6px',
                    flexShrink: 0
                  }}>
                    {date.getDate()}
                  </div>

                  {/* Events */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
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
                            background: hexToRgba(eventColor, 0.15),
                            borderLeft: `2.5px solid ${eventColor}`,
                            color: colors.textPrimary,
                            fontSize: '10px',
                            padding: '3px 4px',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          {event.title}
                          {getRecurrenceBadge(event) && <span style={{ marginLeft: '2px', fontSize: '9px' }}>♻️</span>}
                        </div>
                      )
                    })}
                    {dayEvents.length > 2 && (
                      <div style={{
                        fontSize: '9px',
                        color: colors.textSecondary,
                        padding: '2px 4px',
                        fontWeight: '600'
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
      ) : (
        // Day View - Apple Calendar style
        <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', position: 'relative', paddingTop: '8px', paddingBottom: '8px' }}>
          <div style={{ position: 'relative', minHeight: `${24 * 60}px` }}>
            {/* Hour rows with time labels inline */}
            {hours.map(hour => (
              <div
                key={hour}
                className="calendar-timeslot"
                onTouchStart={(e) => {
                  const touch = e.touches[0]
                  if (touch) {
                    handleTimeSlotTouchStart(hour, touch.clientX, touch.clientY)
                  }
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0]
                  if (touch) {
                    handleTimeSlotTouchMove(touch.clientX, touch.clientY)
                  }
                }}
                onTouchEnd={handleTimeSlotTouchEnd}
                onClick={() => handleTimeSlotTap(hour)}
                style={{
                  height: '60px',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                {/* Time label and horizontal line */}
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

            {/* Bottom 12 AM line (midnight - end of day) */}
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

            {/* 15-minute grid lines - only shown in edit mode */}
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

            {/* Current time indicator with time badge */}
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
                {/* Time badge */}
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
                {/* Red line */}
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

              // Calculate visual position with snapping to 15-minute intervals
              let dragOffset = 0
              if (isBeingDragged) {
                const rawDragOffset = dragCurrentY - dragStartY
                // Calculate where the event would land (snapped to :00, :15, :30, :45)
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
                    // Mouse click (desktop) - maintain old behavior
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
                    cursor: isInEditMode ? 'grabbing' : isDragging ? 'grabbing' : 'pointer',
                    overflow: 'hidden',
                    zIndex: isBeingDragged ? 100 : 5,
                    opacity: isBeingDragged ? 0.8 : 1,
                    transition: isBeingDragged ? 'none' : 'all 0.2s',
                    touchAction: 'none',
                    // Apply pulsing animations based on mode
                    ...(touchedEvent?.id === event.id && isInPreviewMode && !isInEditMode && {
                      boxShadow: isDarkMode
                        ? '0 0 0 2px rgba(255, 255, 255, 0.4), 0 0 0 6px rgba(96, 165, 250, 0.5)'
                        : '0 0 0 2px rgba(0, 0, 0, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.4)',
                      animation: isDarkMode
                        ? 'eventPulseDark 1.5s ease-in-out infinite'
                        : 'eventPulse 1.5s ease-in-out infinite'
                    }),
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

      {/* Event Form Modal - Mobile or Desktop */}
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
            // Refresh events after editing
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
