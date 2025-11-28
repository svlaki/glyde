import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { useCategories } from '../lib/categoryContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserEvents, updateEvent, deleteEvent, createEvent } from '../lib/calendarService'
import { supabase } from '../lib/supabase'
import { getColors, hexToRgba } from '../styles/colors'
import { EventForm } from './EventForm'

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  description?: string
  category?: string
  color?: string
}

type ViewType = 'day' | 'week' | 'month'

export function Calendar() {
  const { user, session } = useAuth()
  const { getCategoryColor, categories, refreshCategories } = useCategories()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [view, setView] = useState<ViewType>('week')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragPreview, setDragPreview] = useState<{ date: Date; hour: number; quarter: number } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Get current week dates
  const getWeekDates = (date: Date) => {
    const week = []
    // Find the Sunday of the week containing 'date'
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek)
      weekDate.setDate(startOfWeek.getDate() + i)
      week.push(weekDate)
    }
    return week
  }

  // Get single day
  const getDayDate = (date: Date) => {
    return [new Date(date)]
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

  // Get event color based on category
  const getEventColor = (event: CalendarEvent): string => {
    // If event has a category, use category color
    if (event.category) {
      return getCategoryColor(event.category)
    }
    // Otherwise use event's color or default
    return event.color || '#3b82f6'
  }


  // Parse time string flexibly (supports "2:30pm", "14:30", "2pm", etc.)
  const parseTime = (timeStr: string): { hours: number; minutes: number } | null => {
    const cleaned = timeStr.trim().toLowerCase()

    // Try 24-hour format (14:30, 9:15)
    const time24Match = cleaned.match(/^(\d{1,2}):(\d{2})$/)
    if (time24Match) {
      const hours = parseInt(time24Match[1])
      const minutes = parseInt(time24Match[2])
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return { hours, minutes }
      }
    }

    // Try 12-hour format with am/pm (2:30pm, 2:30 pm, 9am)
    const time12Match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
    if (time12Match) {
      let hours = parseInt(time12Match[1])
      const minutes = time12Match[2] ? parseInt(time12Match[2]) : 0
      const meridiem = time12Match[3]

      if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        return null
      }

      if (meridiem === 'pm' && hours !== 12) {
        hours += 12
      } else if (meridiem === 'am' && hours === 12) {
        hours = 0
      }

      return { hours, minutes }
    }

    // Try just hour number (assume next upcoming time in 24h format)
    const hourMatch = cleaned.match(/^(\d{1,2})$/)
    if (hourMatch) {
      const hours = parseInt(hourMatch[1])
      if (hours >= 0 && hours <= 23) {
        return { hours, minutes: 0 }
      }
    }

    return null
  }

  const displayDates = view === 'day' ? getDayDate(currentDate) : view === 'week' ? getWeekDates(currentDate) : getMonthDates(currentDate)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Load events and set up real-time subscription
  useEffect(() => {
    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    async function loadEvents(forceRefresh = false) {
      if (!user) return
      console.log('[Calendar] Loading events for user:', user.id, forceRefresh ? '(FORCED REFRESH)' : '')

      try {
        // DIAGNOSTIC: Also fetch directly from Supabase to compare
        const { data: directEvents, error: directError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .order('start_time', { ascending: true })

        console.log('[Calendar] DIRECT Supabase query result:', {
          count: directEvents?.length,
          error: directError,
          events: directEvents
        })

        // Fetch through backend API
        const { events: userEvents } = await fetchUserEvents(user, session?.access_token)
        console.log('[Calendar] Backend API result:', {
          count: userEvents?.length,
          events: userEvents
        })

        // Only update if still subscribed (component not unmounted)
        if (isSubscribed) {
          setEvents(userEvents || [])
          console.log('[Calendar] State updated with', userEvents?.length, 'events')
        }
      } catch (error) {
        console.error('[Calendar] Error loading events:', error)
      }
    }

    loadEvents()

    // Set up real-time subscription for events
    if (!user) return

    console.log('[Calendar] Setting up real-time subscription for user:', user.id)

    const channel = supabase
      .channel(`calendar-events-${user.id}-${Date.now()}`) // Unique channel name
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}` // Only listen to events for this user
        },
        (payload) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('[Calendar] REALTIME EVENT RECEIVED!')
          console.log('Event Type:', payload.eventType)
          console.log('Table:', payload.table)
          console.log('Schema:', payload.schema)
          console.log('New Data:', payload.new)
          console.log('Old Data:', payload.old)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          // Clear any existing refresh timer
          if (refreshTimer) {
            clearTimeout(refreshTimer)
          }

          // Force reload events with a delay to ensure DB is fully updated
          refreshTimer = setTimeout(() => {
            console.log('[Calendar] Triggering refresh from real-time event...')
            loadEvents(true)
          }, 500) // Increased delay to 500ms
        }
      )
      .subscribe((status, err) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('[Calendar] Subscription Status Change:', status)
        if (status === 'SUBSCRIBED') {
          console.log('[Calendar] Successfully subscribed to real-time updates!')
          console.log('Listening for events on table: events')
          console.log('Filter: user_id =', user.id)
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Calendar] Channel error:', err)
        }
        if (status === 'TIMED_OUT') {
          console.error('[Calendar] Subscription timed out - may need to check Supabase realtime settings')
        }
        if (status === 'CLOSED') {
          console.log('[Calendar] Channel closed')
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      })

    // Cleanup subscription on unmount
    return () => {
      console.log('[Calendar] Cleaning up real-time subscription')
      isSubscribed = false
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }
      supabase.removeChannel(channel)
    }
  }, [user, session])

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  // Auto-scroll to 9am when view changes to day/week
  useEffect(() => {
    if ((view === 'day' || view === 'week') && scrollContainerRef.current) {
      // Scroll to 9am: (9 hours * 60px per hour) + 40px header = 580px
      scrollContainerRef.current.scrollTop = 580
    }
  }, [view])

  // Handle clicking a day in month view
  const handleDayClick = (date: Date) => {
    setCurrentDate(date)
    setView('week')
  }

  const formatTime = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}${ampm}`
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  // Get events for a specific date and hour
  const getEventsForSlot = (date: Date, hour: number) => {
    const filtered = events.filter(event => {
      const eventStart = new Date(event.start_time)
      const eventDate = eventStart.toDateString()
      const eventHour = eventStart.getHours()

      const matches = eventDate === date.toDateString() && eventHour === hour

      // Log only when we have events to help debug
      if (matches && events.length > 0) {
        console.log(`[getEventsForSlot] Found event for ${date.toDateString()} at ${hour}:00 -`, event.title)
      }

      return matches
    })
    return filtered
  }

  // Calculate overlap layout for events in the same hour
  const getEventLayout = (event: CalendarEvent, slotEvents: CalendarEvent[]) => {
    // Sort events by start time
    const sortedEvents = [...slotEvents].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )

    // Find overlapping events
    const eventStart = new Date(event.start_time).getTime()
    const eventEnd = new Date(event.end_time).getTime()

    const overlapping = sortedEvents.filter(e => {
      const start = new Date(e.start_time).getTime()
      const end = new Date(e.end_time).getTime()
      // Check if events overlap
      return (start < eventEnd && end > eventStart)
    })

    if (overlapping.length <= 1) {
      return { width: '100%', left: '2px', right: '2px', zIndex: 3 }
    }

    // Calculate position in overlap group
    const index = overlapping.findIndex(e => e.id === event.id)
    const totalOverlapping = overlapping.length

    // Stagger horizontally
    const widthPercent = Math.max(50, 100 / totalOverlapping) // Minimum 50% width
    const offsetPercent = (index * (100 - widthPercent)) / Math.max(1, totalOverlapping - 1)

    return {
      width: `${widthPercent}%`,
      left: `${offsetPercent}%`,
      right: 'auto',
      zIndex: 3 + index
    }
  }

  // Get events for a specific date (for month view)
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time)
      return eventStart.toDateString() === date.toDateString()
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)

    const startMinutes = start.getMinutes()
    const durationMs = end.getTime() - start.getTime()
    const durationMinutes = durationMs / (1000 * 60)

    // Each hour is 60px, so each minute is 1px
    const top = startMinutes
    const height = Math.max(durationMinutes, 15) // Minimum 15px height

    return { top, height }
  }

  // Navigation handlers
  const handlePrev = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  // Event save handler
  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    if (!user) return

    try {
      if (eventData.id) {
        // Update existing event
        const { error } = await updateEvent(
          user,
          eventData.id,
          {
            title: eventData.title!,
            start_time: eventData.start_time!,
            end_time: eventData.end_time!,
            description: eventData.description,
            category: eventData.category
          },
          session?.access_token
        )

        if (error) {
          console.error('Failed to update event:', error)
          throw new Error('Failed to update event: ' + error)
        } else {
          // Update local state
          setEvents(events.map(e => {
            if (e.id === eventData.id) {
              return { ...e, ...eventData } as CalendarEvent
            }
            return e
          }))
          setSelectedEvent(null)
          setIsFormOpen(false)
        }
      } else {
        // Create new event
        const { event: newEvent, error } = await createEvent(
          user,
          {
            title: eventData.title!,
            start_time: eventData.start_time!,
            end_time: eventData.end_time!,
            description: eventData.description,
            category: eventData.category
          },
          session?.access_token
        )

        if (error) {
          console.error('Failed to create event:', error)
          throw new Error('Failed to create event: ' + error)
        } else if (newEvent) {
          // Add to local state
          setEvents([...events, newEvent])
          setSelectedEvent(null)
          setIsFormOpen(false)
        }
      }
    } catch (error) {
      console.error('Error saving event:', error)
      throw error
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !user) return

    try {
      const { error } = await deleteEvent(user, selectedEvent.id, session?.access_token)

      if (error) {
        console.error('Failed to delete event:', error)
        throw new Error('Failed to delete event: ' + error)
      } else {
        // Update local state
        setEvents(events.filter(e => e.id !== selectedEvent.id))
        setSelectedEvent(null)
        setIsFormOpen(false)
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      throw error
    }
  }

  // Handle clicking on calendar to create new event
  const handleCalendarClick = (date: Date, hour: number, halfHour: number) => {
    const startTime = new Date(date)
    startTime.setHours(hour, halfHour * 30, 0, 0)

    const endTime = new Date(startTime)
    endTime.setHours(startTime.getHours() + 1) // Default 1 hour duration

    // Create a template event (no id means it's new)
    const newEventTemplate: any = {
      title: '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      description: '',
      category: ''
    }

    setSelectedEvent(newEventTemplate)
    setIsFormOpen(true)
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggingEvent(event)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Handle drag over to allow drop and show preview
  const handleDragOver = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (!draggingEvent) return

    // Calculate which 15-minute interval we're hovering over (0, 1, 2, or 3)
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const cellHeight = rect.height
    const quarter = Math.max(0, Math.min(3, Math.floor((offsetY / cellHeight) * 4)))

    setDragPreview({ date, hour, quarter })
  }

  // Handle drop with 15-minute snapping
  const handleDrop = async (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()

    if (!draggingEvent || !user) return

    // Get the mouse position within the hour cell
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const cellHeight = rect.height

    // Calculate which 15-minute interval to snap to (0, 15, 30, or 45)
    // Use percentage of cell height to determine quarter
    const quarter = Math.floor((offsetY / cellHeight) * 4)
    const snappedQuarter = Math.max(0, Math.min(3, quarter)) // Clamp to 0-3

    console.log('[Drop] offsetY:', offsetY, 'cellHeight:', cellHeight, 'quarter:', quarter, 'snapped:', snappedQuarter)

    // Calculate new start time with 15-minute snapping
    const newStartTime = new Date(date)
    newStartTime.setHours(hour, snappedQuarter * 15, 0, 0)

    // Calculate duration of original event
    const originalStart = new Date(draggingEvent.start_time)
    const originalEnd = new Date(draggingEvent.end_time)
    const duration = originalEnd.getTime() - originalStart.getTime()

    // Calculate new end time (preserve duration)
    const newEndTime = new Date(newStartTime.getTime() + duration)

    // Update event
    try {
      const { error } = await updateEvent(
        user,
        draggingEvent.id,
        {
          ...draggingEvent,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString()
        },
        session?.access_token
      )

      if (error) {
        console.error('Failed to update event:', error)
        alert('Failed to move event: ' + error)
      } else {
        // Update local state
        setEvents(events.map(e =>
          e.id === draggingEvent.id
            ? { ...e, start_time: newStartTime.toISOString(), end_time: newEndTime.toISOString() }
            : e
        ))
      }
    } catch (error) {
      console.error('Error moving event:', error)
      alert('Error moving event')
    } finally {
      setDraggingEvent(null)
      setDragPreview(null)
    }
  }

  // Handle drag end to clear preview
  const handleDragEnd = () => {
    setDraggingEvent(null)
    setDragPreview(null)
  }

  return (
    <div style={{
      height: '100%',
      background: colors.bgSecondary,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Calendar Header */}
      <div style={{
        padding: '0 20px 20px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: colors.textPrimary, letterSpacing: '0.02em' }}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '3px', marginRight: '6px' }}>
            {(['day', 'week', 'month'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: view === v ? (isDarkMode ? '#d0d0d0' : '#000') : colors.bgTertiary,
                  color: view === v ? (isDarkMode ? '#2a2a2a' : '#fff') : colors.textSecondary,
                  border: view === v ? 'none' : `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  borderRadius: '4px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button
            onClick={handlePrev}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            ←
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {view === 'month' ? (
          // Month View
          <div style={{ padding: '8px', height: '100%', overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: 'auto repeat(6, 1fr)',
              gap: '1px',
              background: colors.border,
              height: '100%'
            }}>
              {/* Week day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{
                  padding: '6px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.05em',
                  color: colors.textSecondary,
                  background: colors.bgSecondary,
                  minWidth: 0,
                  textTransform: 'uppercase'
                }}>
                  {day}
                </div>
              ))}
              {/* Month dates */}
              {displayDates.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString()
                const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                const dayEvents = getEventsForDate(date)

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(date)}
                    style={{
                      padding: '4px',
                      background: colors.bgSecondary,
                      color: isCurrentMonth ? colors.textPrimary : colors.textTertiary,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      minHeight: 0,
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.bgSecondary
                    }}
                  >
                    {/* Date number */}
                    <div style={{
                      fontSize: '14px',
                      fontWeight: isToday ? '600' : '500',
                      color: isToday ? (isDarkMode ? '#2a2a2a' : '#fff') : 'inherit',
                      background: isToday ? (isDarkMode ? '#d0d0d0' : '#000') : 'transparent',
                      width: '25px',
                      height: '25px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '2px',
                      flexShrink: 0
                    }}>
                      {date.getDate()}
                    </div>

                    {/* Events */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      overflow: 'hidden',
                      flex: 1,
                      minHeight: 0
                    }}>
                      {dayEvents.map((event) => {
                        const eventColor = getEventColor(event)
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedEvent(event)
                              setIsFormOpen(true)
                            }}
                            style={{
                              background: hexToRgba(eventColor, 0.15),
                              borderLeft: `3px solid ${eventColor}`,
                              color: colors.textPrimary,
                              fontSize: '11px',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                              flexShrink: 0,
                              fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, 0.25)
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, 0.15)
                            }}
                            title={`${event.title} - ${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                          >
                            {event.title}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          // Day/Week View
          <div style={{ display: 'flex', minHeight: '100%', position: 'relative' }}>
            {/* Time Column */}
            <div style={{
              width: '50px',
              borderRight: `1px solid ${colors.border}`,
              flexShrink: 0,
              background: colors.bgSecondary
            }}>
              <div style={{
                height: '40px',
                borderBottom: `1px solid ${colors.border}`,
                position: 'sticky',
                top: 0,
                zIndex: 20
              }} />
              {hours.map(hour => (
                <div
                  key={hour}
                  style={{
                    height: '60px',
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '4px',
                    fontSize: '12px',
                    color: colors.textSecondary,
                    textAlign: 'center'
                  }}
                >
                  {formatTime(hour)}
                </div>
              ))}
            </div>

            {/* Days Columns */}
            {displayDates.map((date, dayIndex) => {
              const isToday = date.toDateString() === new Date().toDateString()

              return (
                <div
                  key={dayIndex}
                  style={{
                    flex: 1,
                    minWidth: view === 'day' ? '300px' : '100px'
                  }}
                >
                  {/* Day Header */}
                  <div style={{
                    height: '40px',
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '6px',
                    textAlign: 'center',
                    background: isToday ? (isDarkMode ? '#d0d0d0' : '#000') : colors.bgSecondary,
                    color: isToday ? (isDarkMode ? '#2a2a2a' : '#fff') : colors.textPrimary,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 15
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: '500' }}>
                      {getDayName(date)}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>
                      {date.getDate()}
                    </div>
                  </div>

                  {/* Time Slots - 15 minute intervals */}
                  {hours.map(hour => {
                    const slotEvents = getEventsForSlot(date, hour)
                    const isPreviewSlot = dragPreview &&
                      dragPreview.date.toDateString() === date.toDateString() &&
                      dragPreview.hour === hour

                    return (
                      <div
                        key={hour}
                        style={{ position: 'relative' }}
                        onDragOver={(e) => handleDragOver(e, date, hour)}
                        onDrop={(e) => handleDrop(e, date, hour)}
                      >
                        {/* Four 15-minute blocks per hour for drag/drop precision */}
                        {[0, 1, 2, 3].map(quarter => {
                          // Only show borders at hour (:00) and half-hour (:30) marks
                          let borderStyle
                          if (quarter === 3) {
                            // Hour boundary - solid line
                            borderStyle = `1px solid ${colors.border}`
                          } else if (quarter === 1) {
                            // 30-minute mark - solid line
                            borderStyle = `1px solid ${colors.border}`
                          } else {
                            // No border at :15 and :45
                            borderStyle = 'none'
                          }

                          return (
                            <div
                              key={quarter}
                              style={{
                                height: '15px',
                                borderBottom: borderStyle,
                                background: 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.1s',
                                position: 'relative'
                                // Allow pointer events even when dragging so drop zones work
                              }}
                              onClick={(e) => {
                                // Only handle clicks when not dragging
                                if (!draggingEvent) {
                                  e.stopPropagation()
                                  // Convert quarter to halfHour for compatibility with existing click handler
                                  const halfHour = Math.floor(quarter / 2)
                                  handleCalendarClick(date, hour, halfHour)
                                }
                              }}
                              onMouseEnter={(e) => {
                                if (!draggingEvent) {
                                  e.currentTarget.style.background = colors.bgHover
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                              }}
                            />
                          )
                        })}

                        {/* Drag preview indicator */}
                        {isPreviewSlot && draggingEvent && (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${(dragPreview!.quarter / 4) * 100}%`,
                              left: '0',
                              right: '0',
                              height: '4px',
                              background: '#000',
                              zIndex: 100,
                              pointerEvents: 'none',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                            }}
                          />
                        )}

                        {/* Render events */}
                        {slotEvents.map(event => {
                          const { top, height } = getEventStyle(event)
                          const layout = getEventLayout(event, slotEvents)
                          const eventColor = getEventColor(event)
                          const startTime = new Date(event.start_time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })

                          return (
                            <div
                              key={event.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, event)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEvent(event)
                                setIsFormOpen(true)
                              }}
                              style={{
                                position: 'absolute',
                                top: `${top}px`,
                                left: layout.left,
                                right: layout.right,
                                width: layout.width,
                                height: `${height}px`,
                                background: hexToRgba(eventColor, 0.15),
                                borderTop: `4px solid ${eventColor}`,
                                color: colors.textPrimary,
                                borderRadius: '0 0 3px 3px',
                                padding: '2px 6px 3px 6px',
                                fontSize: '11px',
                                fontWeight: '500',
                                overflow: 'hidden',
                                zIndex: layout.zIndex,
                                cursor: draggingEvent?.id === event.id ? 'grabbing' : 'grab',
                                transition: 'background 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, 0.25)
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, 0.15)
                              }}
                              title={`${event.title}\n${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                            >
                              <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: colors.textPrimary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {event.title}
                              </div>
                              {height > 25 && (
                                <div style={{
                                  fontSize: '10px',
                                  color: colors.textSecondary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {startTime}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Current Time Indicator */}
            {(() => {
              const now = currentTime
              const currentHour = now.getHours()
              const currentMinutes = now.getMinutes()
              // Position: (hour * 60px) + (minutes as fraction of hour * 60px) + 40px header
              const topPosition = (currentHour * 60) + (currentMinutes / 60 * 60) + 40

              // Only show if today is in the current view
              const todayInView = displayDates.some(date =>
                date.toDateString() === new Date().toDateString()
              )

              if (!todayInView) return null

              // Format time display
              const displayHour = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour
              const ampm = currentHour >= 12 ? 'PM' : 'AM'
              const timeString = `${displayHour}:${currentMinutes.toString().padStart(2, '0')} ${ampm}`

              return (
                <>
                  {/* Time text with bubble background */}
                  <div style={{
                    position: 'absolute',
                    left: '2px',
                    top: `${topPosition}px`,
                    fontSize: '10px',
                    fontWeight: '600',
                    color: '#fff',
                    background: '#ef4444',
                    padding: '3px 6px',
                    borderRadius: '10px',
                    zIndex: 10,
                    transform: 'translateY(-50%)',
                    whiteSpace: 'nowrap'
                  }}>
                    {timeString}
                  </div>

                  {/* Red line across entire calendar */}
                  <div style={{
                    position: 'absolute',
                    left: '50px',
                    top: `${topPosition}px`,
                    width: 'calc(100% - 50px)',
                    height: '2px',
                    background: '#ef4444',
                    zIndex: 5,
                    pointerEvents: 'none'
                  }} />
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* Event Form */}
      <EventForm
        event={selectedEvent}
        isOpen={isFormOpen}
        onClose={() => {
          setSelectedEvent(null)
          setIsFormOpen(false)
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}
