import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { useAspects } from '../lib/aspectContext'
import { useTheme } from '../lib/themeContext'
import { fetchExpandedEvents, fetchFriendsEvents, updateEvent, deleteEvent, createEvent, updateRecurringEvent, deleteRecurringEvent } from '../lib/calendarService'
import type { CalendarEvent } from '../lib/calendarService'
import { supabase } from '../lib/supabase'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontFamily, fontSize, fontWeight } from '../styles/typography'
import { EventFormUnified } from './event'
import { getRecurrenceBadge } from '../lib/recurrenceUtils'

type ViewType = 'day' | 'week' | 'month'

export function Calendar() {
  const { user, session } = useAuth()
  const { getAspectColor, getAspectById } = useAspects()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false) // Desktop-scaled mobile fonts
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [friendsEvents, setFriendsEvents] = useState<CalendarEvent[]>([])
  const [showFriendsEvents, setShowFriendsEvents] = useState(() => {
    const saved = localStorage.getItem('calendar-show-friends-events')
    return saved !== 'false' // Default to true
  })
  const [view, setView] = useState<ViewType>('week')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragPreview, setDragPreview] = useState<{ date: Date; hour: number; quarter: number } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Persist friends events toggle
  useEffect(() => {
    localStorage.setItem('calendar-show-friends-events', showFriendsEvents.toString())
  }, [showFriendsEvents])

  // Combine user events and friends events for display
  const allEvents = showFriendsEvents ? [...events, ...friendsEvents] : events


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

  // Get event color based on aspect
  const getEventColor = (event: CalendarEvent): string => {
    // If event has an aspect, use aspect color
    if (event.aspect) {
      return getAspectColor(event.aspect)
    }
    // Otherwise use event's color or default
    return event.color || '#3b82f6'
  }

  // Check if an event is a shared event (user is editor/viewer, not owner)
  const isSharedEvent = (event: CalendarEvent): boolean => {
    return event.is_shared === true && event.user_role !== 'owner' && !event.is_friend_event
  }

  // Check if an event is in the past
  const isEventPast = (event: CalendarEvent): boolean => {
    return new Date(event.end_time) < new Date()
  }

  // Toggle missed status for past events
  const handleToggleMissed = async (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation()
    if (!user || !session) return

    const newMissedStatus = !event.is_missed
    // Optimistic update
    setEvents(prev => prev.map(ev =>
      ev.id === event.id ? { ...ev, is_missed: newMissedStatus } : ev
    ))
    try {
      const { error } = await updateEvent(
        user,
        event.id,
        { is_missed: newMissedStatus },
        session.access_token
      )
      if (error) {
        // Revert on error
        setEvents(prev => prev.map(ev =>
          ev.id === event.id ? { ...ev, is_missed: !newMissedStatus } : ev
        ))
      }
    } catch (err) {
      console.error('Error toggling missed status:', err)
      setEvents(prev => prev.map(ev =>
        ev.id === event.id ? { ...ev, is_missed: !newMissedStatus } : ev
      ))
    }
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

        // Fetch friends' events
        const { events: friendEvents } = await fetchFriendsEvents(user, session?.access_token)
        console.log('[Calendar] Friends events result:', {
          count: friendEvents?.length,
          events: friendEvents
        })

        // Only update if still subscribed (component not unmounted)
        if (isSubscribed) {
          setEvents(userEvents || [])
          setFriendsEvents((friendEvents || []).map(e => ({ ...e, is_friend_event: true })))
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
    const filtered = allEvents.filter(event => {
      const eventStart = new Date(event.start_time)
      const eventDate = eventStart.toDateString()
      const eventHour = eventStart.getHours()

      const matches = eventDate === date.toDateString() && eventHour === hour

      return matches
    })
    return filtered
  }

  // Get all events for a specific date (for overlap calculation)
  const getEventsForDay = (date: Date) => {
    return allEvents.filter(event => {
      const eventStart = new Date(event.start_time)
      return eventStart.toDateString() === date.toDateString()
    })
  }

  // Calculate overlap layout using ALL events for the day, not just same-hour events
  const getEventLayout = (event: CalendarEvent, dayEvents: CalendarEvent[]) => {
    const eventStart = new Date(event.start_time).getTime()
    const eventEnd = new Date(event.end_time).getTime()

    // Find all events on this day that overlap with this event's time range
    const overlapping = dayEvents.filter(e => {
      const start = new Date(e.start_time).getTime()
      const end = new Date(e.end_time).getTime()
      return (start < eventEnd && end > eventStart)
    }).sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )

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
    return allEvents.filter(event => {
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
            ...(eventData.aspect ? { aspect: eventData.aspect } : {}),
            ...(eventData.visibility ? { visibility: eventData.visibility } : {})
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
            ...(eventData.aspect ? { aspect: eventData.aspect } : {}),
            ...(eventData.visibility ? { visibility: eventData.visibility } : {})
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
      aspect: ''
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
            aspect: task.aspect_name || task.aspect || ''
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
          {/* Friends Events Toggle */}
          <button
            onClick={() => setShowFriendsEvents(!showFriendsEvents)}
            title={showFriendsEvents ? "Hide friends' events" : "Show friends' events"}
            style={{
              padding: '6px 10px',
              ...typography.labelMd,
              fontWeight: showFriendsEvents ? fontWeight.semibold : fontWeight.medium,
              background: showFriendsEvents ? hexToRgba('#10b981', 0.15) : colors.bgTertiary,
              color: showFriendsEvents ? '#10b981' : colors.textSecondary,
              border: `1px solid ${showFriendsEvents ? hexToRgba('#10b981', 0.3) : colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Friends
            {friendsEvents.length > 0 && (
              <span style={{
                background: showFriendsEvents ? '#10b981' : colors.textTertiary,
                color: '#fff',
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                padding: '1px 5px',
                borderRadius: '10px',
                minWidth: '18px',
                textAlign: 'center'
              }}>
                {friendsEvents.length}
              </span>
            )}
          </button>

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
                        const isFriendEvent = event.is_friend_event
                        const isShared = isSharedEvent(event)
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedEvent(event)
                              setIsFormOpen(true)
                            }}
                            style={{
                              background: hexToRgba(eventColor, isFriendEvent ? 0.08 : 0.12),
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
                              flexShrink: 0,
                              opacity: isFriendEvent ? 0.7 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? 0.12 : 0.2)
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? 0.08 : 0.12)
                            }}
                            title={`${event.title}${isFriendEvent ? ` (${event.owner_display_name || 'Friend'})` : ''}${getRecurrenceBadge(event) ? ' (recurring)' : ''} - ${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                          >
                            {isFriendEvent && (
                              <span style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: hexToRgba(eventColor, 0.3),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '7px',
                                flexShrink: 0,
                                overflow: 'hidden'
                              }}>
                                {event.owner_avatar_url ? (
                                  <img src={event.owner_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  event.owner_display_name?.charAt(0)?.toUpperCase() || 'F'
                                )}
                              </span>
                            )}
                            {/* Shared event role badge in month view */}
                            {isShared && (
                              <span style={{
                                fontSize: '6px',
                                fontFamily: fontFamily.sans,
                                fontWeight: fontWeight.semibold,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                padding: '0px 3px',
                                borderRadius: '2px',
                                background: hexToRgba(eventColor, 0.2),
                                color: eventColor,
                                flexShrink: 0
                              }}>
                                {event.user_role === 'viewer' ? 'V' : 'E'}
                              </span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</span>
                            {(event.aspect_name || event.aspect) && (
                              <span style={{
                                fontSize: '7px',
                                fontFamily: fontFamily.sans,
                                fontWeight: fontWeight.medium,
                                color: eventColor,
                                opacity: 0.5,
                                flexShrink: 0,
                                whiteSpace: 'nowrap'
                              }}>
                                {event.aspect_name || event.aspect}
                              </span>
                            )}
                            {getRecurrenceBadge(event) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                                <path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" /><path d="M2.5 11.5a10 10 0 0 1 18.4-4.5" /><path d="M21.5 12.5a10 10 0 0 1-18.4 4.5" />
                              </svg>
                            )}
                            {/* Missed indicator in month view (display only) */}
                            {!isFriendEvent && isEventPast(event) && event.is_missed && (
                              <span style={{
                                fontSize: '7px',
                                fontFamily: fontFamily.sans,
                                fontWeight: fontWeight.semibold,
                                textTransform: 'uppercase',
                                color: '#ef4444',
                                flexShrink: 0,
                                letterSpacing: '0.3px'
                              }}>
                                Missed
                              </span>
                            )}
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
              const dayEvents = getEventsForDay(date)
              const todayBg = isToday
                ? (isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)')
                : 'transparent'

              return (
                <div
                  key={dayIndex}
                  style={{
                    flex: 1,
                    minWidth: view === 'day' ? '300px' : '100px',
                    position: 'relative',
                    background: todayBg,
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
                    background: isToday
                      ? (isDarkMode ? 'rgba(30,30,30,0.97)' : 'rgba(248,248,248,0.97)')
                      : colors.bgSecondary,
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
                          const layout = getEventLayout(event, dayEvents)
                          const eventColor = getEventColor(event)
                          const startTime = new Date(event.start_time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })
                          const isFriendEvent = event.is_friend_event
                          const isShared = isSharedEvent(event)
                          const isViewerEvent = event.user_role === 'viewer'

                          return (
                            <div
                              key={event.id}
                              draggable={!isFriendEvent && !isViewerEvent}
                              onDragStart={(e) => !isFriendEvent && !isViewerEvent && handleDragStart(e, event)}
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
                                background: hexToRgba(eventColor, isFriendEvent ? 0.08 : 0.12),
                                borderLeft: `3px solid ${eventColor}`,
                                color: eventColor,
                                borderRadius: '4px',
                                padding: '3px 8px',
                                overflow: 'hidden',
                                zIndex: layout.zIndex,
                                cursor: (isFriendEvent || isViewerEvent) ? 'pointer' : (draggingEvent?.id === event.id ? 'grabbing' : 'grab'),
                                transition: 'background 0.15s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                opacity: isFriendEvent ? 0.7 : 1
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? 0.12 : 0.2)
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? 0.08 : 0.12)
                              }}
                              title={`${event.title}${isFriendEvent ? ` (${event.owner_display_name || 'Friend'})` : ''}${getRecurrenceBadge(event) ? ' (recurring)' : ''}\n${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
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
                                {/* Friend avatar indicator */}
                                {isFriendEvent && (
                                  <span style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    background: hexToRgba(eventColor, 0.3),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '8px',
                                    flexShrink: 0,
                                    overflow: 'hidden'
                                  }}>
                                    {event.owner_avatar_url ? (
                                      <img src={event.owner_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      event.owner_display_name?.charAt(0)?.toUpperCase() || 'F'
                                    )}
                                  </span>
                                )}
                                {/* Shared event role badge */}
                                {isShared && (
                                  <span style={{
                                    fontSize: '7px',
                                    fontFamily: fontFamily.sans,
                                    fontWeight: fontWeight.semibold,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    background: hexToRgba(eventColor, 0.2),
                                    color: eventColor,
                                    flexShrink: 0
                                  }}>
                                    {event.user_role === 'viewer' ? 'View' : 'Edit'}
                                  </span>
                                )}
                                <span>{event.title}</span>
                              </div>
                              {/* Missed button - absolute, below title line, right side */}
                              {!isFriendEvent && !isShared && isEventPast(event) && (
                                <button
                                  onClick={(e) => handleToggleMissed(e, event)}
                                  title={event.is_missed ? 'Click to mark as attended' : 'Mark as missed'}
                                  style={{
                                    position: 'absolute',
                                    top: 17,
                                    right: 4,
                                    padding: '0px 3px',
                                    fontSize: '7px',
                                    fontFamily: fontFamily.sans,
                                    fontWeight: fontWeight.semibold,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    lineHeight: '12px',
                                    zIndex: 1,
                                    background: event.is_missed ? '#ef4444' : hexToRgba(eventColor, 0.15),
                                    color: event.is_missed ? '#fff' : hexToRgba(eventColor, 0.5),
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  Missed
                                </button>
                              )}
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
                                  {isFriendEvent ? `${event.owner_display_name || 'Friend'} - ${startTime}` : startTime}
                                </div>
                              )}
                              {/* Aspect name - bottom left */}
                              {(event.aspect_name || event.aspect) && height > 40 && (
                                <span style={{
                                  position: 'absolute',
                                  bottom: 2,
                                  left: 8,
                                  fontSize: '8px',
                                  fontFamily: fontFamily.sans,
                                  fontWeight: fontWeight.medium,
                                  color: eventColor,
                                  opacity: 0.45,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '60%'
                                }}>
                                  {event.aspect_name || event.aspect}
                                </span>
                              )}
                              {getRecurrenceBadge(event) && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', bottom: 2, right: 4, opacity: 0.5, flexShrink: 0 }}>
                                  <path d="M21.5 2v6h-6" />
                                  <path d="M2.5 22v-6h6" />
                                  <path d="M2.5 11.5a10 10 0 0 1 18.4-4.5" />
                                  <path d="M21.5 12.5a10 10 0 0 1-18.4 4.5" />
                                </svg>
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
      {(() => {
        const selectedAspect = selectedEvent?.aspect_id ? getAspectById(selectedEvent.aspect_id) : null
        // Viewer-only if shared aspect viewer OR shared event viewer
        const isViewerOnly = selectedAspect?.member_role === 'viewer' || selectedEvent?.user_role === 'viewer'
        return (
      <EventFormUnified
        event={selectedEvent}
        isOpen={isFormOpen}
        onClose={() => {
          setSelectedEvent(null)
          setIsFormOpen(false)
        }}
        isViewerOnly={isViewerOnly}
        onSave={isViewerOnly ? async () => {} : handleSaveEvent}
        onSaveRecurring={isViewerOnly ? undefined : async (eventData, scope, recurrenceRule) => {
          if (!user || !session) return
          if (eventData.id) {
            const updates: Record<string, string> = {}
            if (eventData.title) updates.title = eventData.title
            if (eventData.start_time) updates.start_time = eventData.start_time
            if (eventData.end_time) updates.end_time = eventData.end_time
            if (eventData.description) updates.description = eventData.description
            if (eventData.aspect) updates.category = eventData.aspect
            if (eventData.visibility) updates.visibility = eventData.visibility

            if (recurrenceRule) updates.recurrence_rule = recurrenceRule
            if (scope === 'this_instance' && selectedEvent?.instance_date) {
              updates.instance_date = selectedEvent.instance_date
            }
            await updateRecurringEvent(user, eventData.id, scope, updates, session.access_token)
          }
          const { events: refreshed } = await fetchExpandedEvents(user, session.access_token)
          setEvents(refreshed || [])
          setSelectedEvent(null)
          setIsFormOpen(false)
        }}
        onDelete={isViewerOnly ? undefined : async (scope) => {
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
        )
      })()}
    </div>
  )
}
