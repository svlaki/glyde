import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { useCategories } from '../lib/categoryContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserEvents, updateEvent, deleteEvent, createEvent } from '../lib/calendarService'
import { supabase } from '../lib/supabase'

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
  const { getCategoryColor, categories } = useCategories()
  const { isDarkMode } = useDarkMode()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [view, setView] = useState<ViewType>('week')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedEvent, setEditedEvent] = useState<CalendarEvent | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Get current week dates
  const getWeekDates = (date: Date) => {
    const week = []
    const current = new Date(date)
    const day = current.getDay()
    const diff = current.getDate() - day // Adjust to Sunday

    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(current.setDate(diff + i))
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

    // Add next month days to complete the grid
    const remainingDays = 7 - (dates.length % 7)
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        dates.push(new Date(year, month + 1, i))
      }
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

  const displayDates = view === 'day' ? getDayDate(currentDate) : view === 'week' ? getWeekDates(currentDate) : getMonthDates(currentDate)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Load events and set up real-time subscription
  useEffect(() => {
    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    async function loadEvents(forceRefresh = false) {
      if (!user) return
      console.log('[Calendar] 📥 Loading events for user:', user.id, forceRefresh ? '(FORCED REFRESH)' : '')

      try {
        // DIAGNOSTIC: Also fetch directly from Supabase to compare
        const { data: directEvents, error: directError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .order('start_time', { ascending: true })

        console.log('[Calendar] 🔍 DIRECT Supabase query result:', {
          count: directEvents?.length,
          error: directError,
          events: directEvents
        })

        // Fetch through backend API
        const { events: userEvents } = await fetchUserEvents(user, session?.access_token)
        console.log('[Calendar] 🌐 Backend API result:', {
          count: userEvents?.length,
          events: userEvents
        })

        // Only update if still subscribed (component not unmounted)
        if (isSubscribed) {
          setEvents(userEvents || [])
          console.log('[Calendar] ✅ State updated with', userEvents?.length, 'events')
        }
      } catch (error) {
        console.error('[Calendar] ❌ Error loading events:', error)
      }
    }

    loadEvents()

    // Set up real-time subscription for events
    if (!user) return

    console.log('[Calendar] 🔌 Setting up real-time subscription for user:', user.id)

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
          console.log('🔔 [Calendar] REALTIME EVENT RECEIVED!')
          console.log('📌 Event Type:', payload.eventType)
          console.log('📌 Table:', payload.table)
          console.log('📌 Schema:', payload.schema)
          console.log('📌 New Data:', payload.new)
          console.log('📌 Old Data:', payload.old)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          // Clear any existing refresh timer
          if (refreshTimer) {
            clearTimeout(refreshTimer)
          }

          // Force reload events with a delay to ensure DB is fully updated
          refreshTimer = setTimeout(() => {
            console.log('🔄 [Calendar] Triggering refresh from real-time event...')
            loadEvents(true)
          }, 500) // Increased delay to 500ms
        }
      )
      .subscribe((status, err) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📡 [Calendar] Subscription Status Change:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Calendar] Successfully subscribed to real-time updates!')
          console.log('📌 Listening for events on table: events')
          console.log('📌 Filter: user_id =', user.id)
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Calendar] Channel error:', err)
        }
        if (status === 'TIMED_OUT') {
          console.error('⏱️ [Calendar] Subscription timed out - may need to check Supabase realtime settings')
        }
        if (status === 'CLOSED') {
          console.log('🔌 [Calendar] Channel closed')
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

  // Auto-scroll to 8am when view changes to day/week
  useEffect(() => {
    if ((view === 'day' || view === 'week') && scrollContainerRef.current) {
      // Scroll to 8am: (8 hours * 60px per hour) + 40px header = 520px
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({
          top: 520,
          behavior: 'smooth'
        })
      }, 100)
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
    return events.filter(event => {
      const eventStart = new Date(event.start_time)
      const eventDate = eventStart.toDateString()
      const eventHour = eventStart.getHours()

      return eventDate === date.toDateString() && eventHour === hour
    })
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

  // Event editing handlers
  const handleEditClick = () => {
    if (selectedEvent) {
      setEditedEvent({ ...selectedEvent })
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedEvent(null)
  }

  const handleSaveEdit = async () => {
    if (!editedEvent || !user) return

    // Validate that title is not empty
    if (!editedEvent.title.trim()) {
      alert('Please enter a title for the event')
      return
    }

    try {
      if (editedEvent.id) {
        // Update existing event
        const { error } = await updateEvent(
          user,
          editedEvent.id,
          {
            title: editedEvent.title,
            start_time: editedEvent.start_time,
            end_time: editedEvent.end_time,
            description: editedEvent.description,
            category: editedEvent.category
          },
          session?.access_token
        )

        if (error) {
          console.error('Failed to update event:', error)
          alert('Failed to update event: ' + error)
        } else {
          // Update local state
          setEvents(events.map(e => e.id === editedEvent.id ? editedEvent : e))
          setSelectedEvent(editedEvent)
          setIsEditing(false)
          setEditedEvent(null)
        }
      } else {
        // Create new event
        const { event: newEvent, error } = await createEvent(
          user,
          {
            title: editedEvent.title,
            start_time: editedEvent.start_time,
            end_time: editedEvent.end_time,
            description: editedEvent.description,
            category: editedEvent.category
          },
          session?.access_token
        )

        if (error) {
          console.error('Failed to create event:', error)
          alert('Failed to create event: ' + error)
        } else if (newEvent) {
          // Add to local state
          setEvents([...events, newEvent])
          setSelectedEvent(null)
          setIsEditing(false)
          setEditedEvent(null)
        }
      }
    } catch (error) {
      console.error('Error saving event:', error)
      alert('Error saving event')
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !user) return

    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const { error } = await deleteEvent(user, selectedEvent.id, session?.access_token)

      if (error) {
        console.error('Failed to delete event:', error)
        alert('Failed to delete event: ' + error)
      } else {
        // Update local state
        setEvents(events.filter(e => e.id !== selectedEvent.id))
        setSelectedEvent(null)
        setIsEditing(false)
        setEditedEvent(null)
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Error deleting event')
    }
  }

  // Handle clicking on calendar to create new event
  const handleCalendarClick = (date: Date, hour: number, quarterHour: number) => {
    const startTime = new Date(date)
    startTime.setHours(hour, quarterHour * 15, 0, 0)

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

    setEditedEvent(newEventTemplate)
    setSelectedEvent(newEventTemplate)
    setIsEditing(true)
  }

  return (
    <div style={{
      height: '100%',
      background: isDarkMode ? '#1a1a1a' : '#fff',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Calendar Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: isDarkMode ? '#fff' : '#000' }}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
            {(['day', 'week', 'month'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: view === v ? (isDarkMode ? '#fff' : '#000') : (isDarkMode ? '#2a2a2a' : '#f5f5f5'),
                  color: view === v ? (isDarkMode ? '#000' : '#fff') : (isDarkMode ? '#999' : '#666'),
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
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
          <div style={{ padding: '12px', height: '100%', overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: 'auto repeat(6, 1fr)',
              gap: '1px',
              background: isDarkMode ? '#2a2a2a' : '#e5e5e5',
              height: '100%'
            }}>
              {/* Week day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{
                  padding: '6px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: isDarkMode ? '#999' : '#666',
                  background: isDarkMode ? '#0a0a0a' : '#fafafa',
                  minWidth: 0
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
                      background: isDarkMode ? '#1a1a1a' : '#fff',
                      color: isCurrentMonth ? (isDarkMode ? '#fff' : '#000') : (isDarkMode ? '#555' : '#ccc'),
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
                      e.currentTarget.style.background = isDarkMode ? '#2a2a2a' : '#f9f9f9'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isDarkMode ? '#1a1a1a' : '#fff'
                    }}
                  >
                    {/* Date number */}
                    <div style={{
                      fontSize: '12px',
                      fontWeight: isToday ? '600' : '400',
                      color: isToday ? (isDarkMode ? '#000' : '#fff') : 'inherit',
                      background: isToday ? (isDarkMode ? '#fff' : '#000') : 'transparent',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '3px',
                      flexShrink: 0
                    }}>
                      {date.getDate()}
                    </div>

                    {/* Events */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1px',
                      overflow: 'hidden',
                      flex: 1,
                      minHeight: 0
                    }}>
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEvent(event)
                          }}
                          style={{
                            background: getEventColor(event),
                            color: '#fff',
                            fontSize: '9px',
                            padding: '2px 3px',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.8'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1'
                          }}
                          title={`${event.title} - ${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                        >
                          {new Date(event.start_time).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })} {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div style={{
                          fontSize: '9px',
                          color: '#666',
                          padding: '1px 3px',
                          fontWeight: '500',
                          flexShrink: 0
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
          // Day/Week View
          <div style={{ display: 'flex', minHeight: '100%', position: 'relative' }}>
            {/* Time Column */}
            <div style={{
              width: '50px',
              borderRight: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
              flexShrink: 0,
              background: isDarkMode ? '#0a0a0a' : '#fafafa'
            }}>
              <div style={{
                height: '40px',
                borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                position: 'sticky',
                top: 0,
                background: isDarkMode ? '#0a0a0a' : '#fafafa',
                zIndex: 20
              }} />
              {hours.map(hour => (
                <div
                  key={hour}
                  style={{
                    height: '60px',
                    borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #f0f0f0',
                    padding: '4px',
                    fontSize: '10px',
                    color: isDarkMode ? '#999' : '#666',
                    textAlign: 'right'
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
                    borderRight: dayIndex < displayDates.length - 1 ? (isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5') : 'none',
                    minWidth: view === 'day' ? '300px' : '100px'
                  }}
                >
                  {/* Day Header */}
                  <div style={{
                    height: '40px',
                    borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                    padding: '6px',
                    textAlign: 'center',
                    background: isToday ? (isDarkMode ? '#fff' : '#000') : (isDarkMode ? '#0a0a0a' : '#fafafa'),
                    color: isToday ? (isDarkMode ? '#000' : '#fff') : (isDarkMode ? '#fff' : '#000'),
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

                    return (
                      <div key={hour} style={{ position: 'relative' }}>
                        {/* Four 15-minute blocks per hour */}
                        {[0, 1, 2, 3].map(quarterHour => (
                          <div
                            key={quarterHour}
                            style={{
                              height: '15px',
                              borderBottom: quarterHour === 3 ? (isDarkMode ? '1px solid #2a2a2a' : '1px solid #f0f0f0') : (isDarkMode ? '1px solid #1a1a1a' : '1px solid #f5f5f5'),
                              background: isToday && hour === new Date().getHours() ? (isDarkMode ? '#1a1a1a' : '#f9f9f9') : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.1s',
                              position: 'relative'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCalendarClick(date, hour, quarterHour)
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = isDarkMode ? '#2a3a4a' : '#e8f4ff'
                            }}
                            onMouseLeave={(e) => {
                              if (isToday && hour === new Date().getHours()) {
                                e.currentTarget.style.background = isDarkMode ? '#1a1a1a' : '#f9f9f9'
                              } else {
                                e.currentTarget.style.background = 'transparent'
                              }
                            }}
                          />
                        ))}

                        {/* Render events */}
                        {slotEvents.map(event => {
                          const { top, height } = getEventStyle(event)
                          return (
                            <div
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEvent(event)
                              }}
                              style={{
                                position: 'absolute',
                                top: `${top}px`,
                                left: '2px',
                                right: '2px',
                                height: `${height}px`,
                                background: getEventColor(event),
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                fontSize: '11px',
                                fontWeight: '500',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                zIndex: 3,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                cursor: 'pointer',
                                transition: 'transform 0.1s, box-shadow 0.1s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.02)'
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)'
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                              }}
                              title={`${event.title}\n${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                            >
                              {event.title}
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
                  {/* Time text on the left */}
                  <div style={{
                    position: 'absolute',
                    left: '2px',
                    top: `${topPosition}px`,
                    fontSize: '10px',
                    fontWeight: '600',
                    color: '#ef4444',
                    zIndex: 10,
                    transform: 'translateY(-50%)',
                    whiteSpace: 'nowrap'
                  }}>
                    {timeString}
                  </div>

                  {/* Red dot on time column */}
                  <div style={{
                    position: 'absolute',
                    left: '45px',
                    top: `${topPosition}px`,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    zIndex: 10,
                    transform: 'translateY(-50%)'
                  }} />

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

      {/* Event Details Modal */}
      {selectedEvent && (
        <>
          {/* Invisible overlay to detect outside clicks */}
          <div
            onClick={() => {
              setSelectedEvent(null)
              setIsEditing(false)
              setEditedEvent(null)
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99
            }}
          />

          {/* Modal Box */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: isDarkMode ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.2)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
              zIndex: 100,
              width: '420px',
              maxHeight: '550px',
              overflow: 'auto',
              animation: 'popIn 0.2s ease-out',
              backdropFilter: 'blur(8px)'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: 0,
                color: isDarkMode ? '#fff' : '#000'
              }}>
                {isEditing ? (editedEvent?.id ? 'Edit Event' : 'Create Event') : 'Event Details'}
              </h2>
              <button
                onClick={() => {
                  setSelectedEvent(null)
                  setIsEditing(false)
                  setEditedEvent(null)
                }}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                  color: isDarkMode ? '#fff' : '#000',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {isEditing && editedEvent ? (
                // Edit Mode
                <>
                  {/* Title Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isDarkMode ? '#999' : '#666',
                      marginBottom: '6px'
                    }}>
                      TITLE
                    </label>
                    <input
                      type="text"
                      value={editedEvent.title}
                      onChange={(e) => setEditedEvent({ ...editedEvent, title: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: isDarkMode ? '#1a1a1a' : '#fff',
                        color: isDarkMode ? '#fff' : '#000'
                      }}
                    />
                  </div>

                  {/* Start Time Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isDarkMode ? '#999' : '#666',
                      marginBottom: '6px'
                    }}>
                      START TIME
                    </label>
                    <input
                      type="datetime-local"
                      value={new Date(editedEvent.start_time).toISOString().slice(0, 16)}
                      onChange={(e) => setEditedEvent({
                        ...editedEvent,
                        start_time: new Date(e.target.value).toISOString()
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: isDarkMode ? '#1a1a1a' : '#fff',
                        color: isDarkMode ? '#fff' : '#000',
                        colorScheme: isDarkMode ? 'dark' : 'light'
                      }}
                    />
                  </div>

                  {/* End Time Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isDarkMode ? '#999' : '#666',
                      marginBottom: '6px'
                    }}>
                      END TIME
                    </label>
                    <input
                      type="datetime-local"
                      value={new Date(editedEvent.end_time).toISOString().slice(0, 16)}
                      onChange={(e) => setEditedEvent({
                        ...editedEvent,
                        end_time: new Date(e.target.value).toISOString()
                      })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: isDarkMode ? '#1a1a1a' : '#fff',
                        color: isDarkMode ? '#fff' : '#000',
                        colorScheme: isDarkMode ? 'dark' : 'light'
                      }}
                    />
                  </div>

                  {/* Category Select */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isDarkMode ? '#999' : '#666',
                      marginBottom: '6px'
                    }}>
                      CATEGORY
                    </label>
                    <select
                      value={editedEvent.category || ''}
                      onChange={(e) => setEditedEvent({ ...editedEvent, category: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: isDarkMode ? '#1a1a1a' : '#fff',
                        color: isDarkMode ? '#fff' : '#000'
                      }}
                    >
                      <option value="">No category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description Textarea */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isDarkMode ? '#999' : '#666',
                      marginBottom: '6px'
                    }}>
                      DESCRIPTION
                    </label>
                    <textarea
                      value={editedEvent.description || ''}
                      onChange={(e) => setEditedEvent({ ...editedEvent, description: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical',
                        background: isDarkMode ? '#1a1a1a' : '#fff',
                        color: isDarkMode ? '#fff' : '#000'
                      }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                    <button
                      onClick={handleSaveEdit}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: isDarkMode ? '#fff' : '#000',
                        color: isDarkMode ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      {editedEvent?.id ? 'Save Changes' : 'Create Event'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                        color: isDarkMode ? '#999' : '#666',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                // View Mode
                <>
                  {/* Title */}
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      margin: 0,
                      color: isDarkMode ? '#fff' : '#000'
                    }}>
                      {selectedEvent.title}
                    </h3>
                    {selectedEvent.category && (
                      <div style={{
                        display: 'inline-block',
                        marginTop: '8px',
                        padding: '4px 10px',
                        background: getEventColor(selectedEvent),
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {selectedEvent.category}
                      </div>
                    )}
                  </div>

                  {/* Date and Time */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isDarkMode ? '#999' : '#666',
                      marginBottom: '6px'
                    }}>
                      DATE & TIME
                    </div>
                    <div style={{ fontSize: '14px', color: isDarkMode ? '#fff' : '#000' }}>
                      {new Date(selectedEvent.start_time).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div style={{ fontSize: '14px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                      {new Date(selectedEvent.start_time).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit'
                      })} - {new Date(selectedEvent.end_time).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedEvent.description && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: isDarkMode ? '#999' : '#666',
                        marginBottom: '6px'
                      }}>
                        DESCRIPTION
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: isDarkMode ? '#fff' : '#000',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {selectedEvent.description}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                    <button
                      onClick={handleEditClick}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: isDarkMode ? '#fff' : '#000',
                        color: isDarkMode ? '#000' : '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={handleDeleteEvent}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <style>{`
            @keyframes popIn {
              from {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.9);
              }
              to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
              }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
