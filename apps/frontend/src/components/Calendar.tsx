import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { useCategories } from '../lib/categoryContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchExpandedEvents, updateEvent, deleteEvent, createEvent, updateRecurringEvent, deleteRecurringEvent } from '../lib/calendarService'
import { supabase } from '../lib/supabase'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontFamily, fontSize, fontWeight } from '../styles/typography'
import { EventFormUnified } from './event'
import { getRecurrenceBadge } from '../lib/recurrenceUtils'

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  description?: string
  category?: string
  color?: string
  // Recurrence fields
  recurrence_rule?: string
  parent_event_id?: string
  is_recurring?: boolean
  is_instance?: boolean
}

type ViewType = 'day' | 'week' | 'month'

export function Calendar() {
  const { user, session } = useAuth()
  const { getCategoryColor } = useCategories()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const typography = getTypography(false) // Desktop-scaled mobile fonts
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
  const _parseTime = (timeStr: string): { hours: number; minutes: number } | null => {
    const cleaned = timeStr.trim().toLowerCase()

    // Try 24-hour format (14:30, 9:15)
    const time24Match = cleaned.match(/^(\d{1,2}):(\d{2})$/)
    if (time24Match && time24Match[1] && time24Match[2]) {
      const hours = parseInt(time24Match[1])
      const minutes = parseInt(time24Match[2])
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return { hours, minutes }
      }
    }

    // Try 12-hour format with am/pm (2:30pm, 2:30 pm, 9am)
    const time12Match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
    if (time12Match && time12Match[1]) {
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
    if (hourMatch && hourMatch[1]) {
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

        // Fetch through backend API with recurring events expanded
        const { events: userEvents } = await fetchExpandedEvents(user, session?.access_token)
        console.log('[Calendar] Backend API result (with expanded recurring events):', {
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

  const _formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const _getDayName = (date: Date) => {
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
            ...(eventData.description ? { description: eventData.description } : {}),
            ...(eventData.category ? { category: eventData.category } : {})
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
            ...(eventData.description ? { description: eventData.description } : {}),
            ...(eventData.category ? { category: eventData.category } : {})
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

  // State for dragging tasks from TodoList
  const [draggingTask, setDraggingTask] = useState<boolean>(false)

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggingEvent(event)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Handle drag over to allow drop and show preview
  const handleDragOver = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()

    // Check if dragging a task from TodoList
    const hasTask = e.dataTransfer.types.includes('application/glyde-task')
    if (hasTask) {
      e.dataTransfer.dropEffect = 'copy'
      setDraggingTask(true)
    } else {
      e.dataTransfer.dropEffect = 'move'
    }

    if (!draggingEvent && !hasTask) return

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

    if (!user) return

    // Get the mouse position within the hour cell
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const cellHeight = rect.height

    // Calculate which 15-minute interval to snap to (0, 15, 30, or 45)
    const quarter = Math.floor((offsetY / cellHeight) * 4)
    const snappedQuarter = Math.max(0, Math.min(3, quarter)) // Clamp to 0-3

    // Calculate new start time with 15-minute snapping
    const newStartTime = new Date(date)
    newStartTime.setHours(hour, snappedQuarter * 15, 0, 0)

    // Check if this is a task being dropped from TodoList
    const taskData = e.dataTransfer.getData('application/glyde-task')
    if (taskData) {
      try {
        const task = JSON.parse(taskData)
        console.log('[Drop] Creating event from task:', task.title)

        // Use task's estimated_duration if available, otherwise default to 1 hour
        const durationMinutes = task.estimated_duration || 60
        const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60 * 1000)

        // Create event from task
        const { event: newEvent, error } = await createEvent(
          user,
          {
            title: task.title,
            start_time: newStartTime.toISOString(),
            end_time: newEndTime.toISOString(),
            description: task.description || `Scheduled time for task: ${task.title}`,
            category: task.category_name || task.category || ''
          },
          session?.access_token
        )

        if (error) {
          console.error('Failed to create event from task:', error)
          alert('Failed to schedule task: ' + error)
        } else if (newEvent) {
          // Add to local state
          setEvents([...events, newEvent])
          console.log('[Drop] Event created successfully from task')
        }
      } catch (err) {
        console.error('Error creating event from task:', err)
        alert('Error scheduling task')
      } finally {
        setDraggingTask(false)
        setDragPreview(null)
      }
      return
    }

    // Handle normal event drag (existing behavior)
    if (!draggingEvent) return

    console.log('[Drop] Moving event:', draggingEvent.title)

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
    setDraggingTask(false)
    setDragPreview(null)
  }


  return (
    <div style={{
      height: '100%',
      width: '100%',
      flex: 1,
      background: colors.bgSecondary,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Calendar Header - Mobile-style design */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bgSecondary,
      }}>
        <h2 style={{
          ...typography.headingLg,
          fontWeight: fontWeight.bold,
          color: colors.textPrimary,
          margin: 0
        }}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View Toggle - Mobile pill style */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: colors.bgTertiary,
            padding: '4px',
            borderRadius: '10px'
          }}>
            {(['day', 'week', 'month'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 14px',
                  ...typography.labelLg,
                  fontWeight: view === v ? fontWeight.semibold : fontWeight.medium,
                  background: view === v ? colors.bgSecondary : 'transparent',
                  color: view === v ? colors.textPrimary : colors.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  borderRadius: '8px',
                  transition: 'all 0.15s',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Navigation - Mobile style buttons */}
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            <button
              onClick={handlePrev}
              style={{
                padding: '8px',
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover
                e.currentTarget.style.color = colors.textPrimary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.bgTertiary
                e.currentTarget.style.color = colors.textSecondary
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              style={{
                padding: '8px 14px',
                ...typography.labelLg,
                fontWeight: 500,
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover
                e.currentTarget.style.color = colors.textPrimary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.bgTertiary
                e.currentTarget.style.color = colors.textSecondary
              }}
            >
              Today
            </button>
            <button
              onClick={handleNext}
              style={{
                padding: '8px',
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover
                e.currentTarget.style.color = colors.textPrimary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.bgTertiary
                e.currentTarget.style.color = colors.textSecondary
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {view === 'month' ? (
          // Month View - Mobile-style grid
          <div style={{ padding: '0', height: '100%', overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: 'auto repeat(6, 1fr)',
              height: '100%'
            }}>
              {/* Week day headers - Match day/week view style */}
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => (
                <div key={index} style={{
                  padding: '8px 4px',
                  textAlign: 'center',
                  fontSize: fontSize.sm,
                  fontFamily: fontFamily.sans,
                  fontWeight: fontWeight.medium,
                  color: colors.textTertiary,
                  background: colors.bgSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}>
                  {day}
                </div>
              ))}
              {/* Month dates - Mobile-style cells */}
              {displayDates.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString()
                const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                const dayEvents = getEventsForDate(date)
                const col = idx % 7

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
                      minWidth: 0,
                      minHeight: '80px',
                      overflow: 'hidden',
                      borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                      borderRight: col < 6 ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` : 'none',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.bgSecondary
                    }}
                  >
                    {/* Date number - Mobile style circle for today */}
                    <div style={{
                      ...typography.bodySm,
                      fontWeight: isToday ? 600 : 400,
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

                    {/* Events - Mobile style with 2 visible + "+X more" */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      overflow: 'hidden',
                      flex: 1,
                      minHeight: 0
                    }}>
                      {dayEvents.slice(0, 2).map((event) => {
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
                              background: hexToRgba(eventColor, 0.12),
                              borderLeft: `2px solid ${eventColor}`,
                              color: colors.textPrimary,
                              fontSize: fontSize.xs,
                              fontFamily: fontFamily.sans,
                              fontWeight: fontWeight.medium,
                              padding: '3px 6px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, 0.2)
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, 0.12)
                            }}
                            title={`${event.title}${getRecurrenceBadge(event) ? ' (recurring)' : ''} - ${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                          >
                            {event.title}
                            {getRecurrenceBadge(event) && <span style={{ marginLeft: '3px', fontSize: fontSize.xs, opacity: 0.7 }}>R</span>}
                          </div>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <div style={{
                          fontSize: fontSize.xs,
                          fontFamily: fontFamily.sans,
                          fontWeight: fontWeight.medium,
                          color: colors.textSecondary,
                          padding: '2px 6px'
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
          // Day/Week View - Mobile-style design
          <div style={{ display: 'flex', minHeight: '100%', position: 'relative' }}>
            {/* Time Column - Mobile-style sticky gutter with timezone */}
            <div style={{
              width: '52px',
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 20,
              background: colors.bgSecondary
            }}>
              {/* Timezone header - sticky top */}
              <div style={{
                position: 'sticky',
                top: 0,
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: fontSize.xs,
                fontFamily: fontFamily.sans,
                fontWeight: fontWeight.normal,
                color: colors.textTertiary,
                background: colors.bgSecondary,
                zIndex: 30,
              }}>
                {new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()}
              </div>
              {/* Spacer for gap between header and first hour */}
              <div style={{ height: '12px' }} />
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
                    fontSize: fontSize.xs,
                    fontFamily: fontFamily.sans,
                    color: colors.textTertiary,
                    background: colors.bgSecondary,
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatTime(hour)}
                  </span>
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
                    minWidth: view === 'day' ? '300px' : '100px',
                    position: 'relative'
                  }}
                >
                  {/* Day Header - Mobile style */}
                  <div style={{
                    position: 'sticky',
                    top: 0,
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: fontSize.sm,
                    fontFamily: fontFamily.sans,
                    fontWeight: fontWeight.medium,
                    color: isToday ? colors.error : colors.textTertiary,
                    background: colors.bgSecondary,
                    zIndex: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}>
                    <span>
                      {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]}
                    </span>
                    <span style={{ fontWeight: isToday ? fontWeight.semibold : fontWeight.medium }}>
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Spacer for gap between header and first hour */}
                  <div style={{ height: '12px' }} />

                  {/* Time Slots - Mobile-style hour grid */}
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
                          // Mobile-style: subtle borders at hour marks only
                          const borderStyle = quarter === 3
                            ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                            : 'none'

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
                              }}
                              onClick={(e) => {
                                if (!draggingEvent) {
                                  e.stopPropagation()
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
                        {isPreviewSlot && (draggingEvent || draggingTask) && (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${(dragPreview!.quarter / 4) * 100}%`,
                              left: '0',
                              right: '0',
                              height: '4px',
                              background: draggingTask ? '#10b981' : '#000', // Green for task drop, black for event move
                              zIndex: 100,
                              pointerEvents: 'none',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                            }}
                          />
                        )}

                        {/* Render events - Mobile-style cards with left border */}
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
                                left: layout.left === '2px' ? '4px' : layout.left,
                                right: layout.right === '2px' ? '4px' : layout.right,
                                width: layout.width,
                                height: `${height}px`,
                                background: hexToRgba(eventColor, 0.12),
                                borderLeft: `3px solid ${eventColor}`,
                                color: eventColor,
                                borderRadius: '4px',
                                padding: '3px 8px',
                                overflow: 'hidden',
                                zIndex: layout.zIndex,
                                cursor: draggingEvent?.id === event.id ? 'grabbing' : 'grab',
                                transition: 'background 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, 0.2)
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, 0.12)
                              }}
                              title={`${event.title}${getRecurrenceBadge(event) ? ' (recurring)' : ''}\n${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                            >
                              <div style={{
                                ...typography.labelMd,
                                fontWeight: fontWeight.semibold,
                                color: eventColor,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <span>{event.title}</span>
                                {getRecurrenceBadge(event) && <span style={{ fontSize: fontSize.xs, flexShrink: 0, opacity: 0.7 }}>R</span>}
                              </div>
                              {height > 30 && (
                                <div style={{
                                  fontSize: fontSize.xs,
                                  fontFamily: fontFamily.sans,
                                  color: eventColor,
                                  opacity: 0.8,
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

            {/* Current Time Indicator - Mobile style (time in gutter + continuous red line) */}
            {(() => {
              const now = currentTime
              const currentHour = now.getHours()
              const currentMinutes = now.getMinutes()
              // Position: (hour * 60px) + (minutes as fraction of hour * 60px) + 36px header
              const topPosition = (currentHour * 60) + (currentMinutes / 60 * 60) + 36

              // Only show if today is in the current view
              const todayInView = displayDates.some(date =>
                date.toDateString() === new Date().toDateString()
              )

              if (!todayInView) return null

              return (
                <>
                  {/* Time label in gutter - uses error color */}
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: `${topPosition}px`,
                    width: '52px',
                    transform: 'translateY(-50%)',
                    fontSize: fontSize.xs,
                    fontFamily: fontFamily.sans,
                    fontWeight: fontWeight.semibold,
                    color: colors.error,
                    background: colors.bgSecondary,
                    textAlign: 'center',
                    zIndex: 25,
                    whiteSpace: 'nowrap'
                  }}>
                    {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>

                  {/* Continuous red line across all columns */}
                  <div style={{
                    position: 'absolute',
                    left: '52px',
                    top: `${topPosition}px`,
                    width: 'calc(100% - 52px)',
                    height: '2px',
                    background: colors.error,
                    zIndex: 15,
                    pointerEvents: 'none'
                  }} />
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* Unified Event Form */}
      <EventFormUnified
        event={selectedEvent}
        isOpen={isFormOpen}
        onClose={() => {
          setSelectedEvent(null)
          setIsFormOpen(false)
        }}
        onSave={handleSaveEvent}
        onSaveRecurring={async (eventData, scope, recurrenceRule) => {
          if (!user || !session) return
          if (eventData.id) {
            const updates: Record<string, string> = {}
            if (eventData.title) updates.title = eventData.title
            if (eventData.start_time) updates.start_time = eventData.start_time
            if (eventData.end_time) updates.end_time = eventData.end_time
            if (eventData.description) updates.description = eventData.description
            if (eventData.category) updates.category = eventData.category
            if (recurrenceRule) updates.recurrence_rule = recurrenceRule
            await updateRecurringEvent(user, eventData.id, scope, updates, session.access_token)
          }
          const { events: refreshed } = await fetchExpandedEvents(user, session.access_token)
          setEvents(refreshed || [])
          setSelectedEvent(null)
          setIsFormOpen(false)
        }}
        onDelete={async (scope) => {
          if (!selectedEvent || !user) return
          if (scope) {
            await deleteRecurringEvent(user, selectedEvent.id, scope, session?.access_token)
            const { events: refreshed } = await fetchExpandedEvents(user, session?.access_token)
            setEvents(refreshed || [])
          } else {
            await deleteEvent(user, selectedEvent.id, session?.access_token)
            setEvents(events.filter(e => e.id !== selectedEvent.id))
          }
          setSelectedEvent(null)
          setIsFormOpen(false)
        }}
      />
    </div>
  )
}
