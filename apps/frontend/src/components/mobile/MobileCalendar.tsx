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

  // Drag state for events
  const [isDragging, setIsDragging] = useState(false)
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragStartY, setDragStartY] = useState<number>(0)
  const [dragCurrentY, setDragCurrentY] = useState<number>(0)

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

  // Load events
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

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Scroll to current time
  useEffect(() => {
    if (view === 'day' && scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const now = new Date()
          const currentMinutes = now.getHours() * 60 + now.getMinutes()
          const containerHeight = scrollContainerRef.current.clientHeight
          const totalHeight = 24 * 60
          const maxScroll = totalHeight - containerHeight
          const idealScroll = currentMinutes - (containerHeight / 3)
          const scrollPosition = Math.max(0, Math.min(idealScroll, maxScroll))
          scrollContainerRef.current.scrollTop = scrollPosition
        }
      }, 100)
    }
  }, [view, currentDate])

  const handleDayClick = (date: Date) => {
    onDateChange(date)
  }

  const formatTime = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour} ${ampm}`
  }

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
  const handleEventTouchStart = (event: CalendarEvent, clientY: number, clientX: number) => {
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

    setTouchedEvent(event)
    setIsInEditMode(false)
    setIsDragging(false)

    // After 400ms, enter edit mode (enable dragging while holding)
    const timer = setTimeout(() => {
      isInEditModeRef.current = true
      setIsInEditMode(true)
      setEventTouchTimer(null)
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

  const handleEventTouchEnd = async () => {
    const touchDuration = Date.now() - touchStartTimeRef.current

    if (eventTouchTimer) {
      clearTimeout(eventTouchTimer)
      setEventTouchTimer(null)
    }

    // If dragging, complete the drag
    if (isDraggingRef.current && draggingEventRef.current) {
      const deltaY = dragCurrentYRef.current - dragStartYRef.current
      const rawDeltaMinutes = deltaY

      if (Math.abs(rawDeltaMinutes) >= 10) {
        const originalStart = new Date(draggingEventRef.current.start_time)
        const originalEnd = new Date(draggingEventRef.current.end_time)
        const duration = originalEnd.getTime() - originalStart.getTime()

        const newStartRaw = new Date(originalStart.getTime() + rawDeltaMinutes * 60 * 1000)
        const snappedMinutes = Math.round(newStartRaw.getMinutes() / 15) * 15
        const newStart = new Date(newStartRaw)
        newStart.setMinutes(snappedMinutes, 0, 0)
        const newEnd = new Date(newStart.getTime() + duration)

        await handleUpdateEvent(draggingEventRef.current.id, {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        })
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

    // Reset all state
    touchedEventRef.current = null
    isInEditModeRef.current = false
    isDraggingRef.current = false
    draggingEventRef.current = null
    dragStartYRef.current = 0
    dragCurrentYRef.current = 0
    touchStartPosRef.current = null
    hasMovedRef.current = false

    setTouchedEvent(null)
    setIsInEditMode(false)
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
            minHeight: '100%'
          }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
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
              const isToday = date.toDateString() === new Date().toDateString()
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const dayEvents = getEventsForDate(date)
              const col = idx % 7
              const row = Math.floor(idx / 7)

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(date)}
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
