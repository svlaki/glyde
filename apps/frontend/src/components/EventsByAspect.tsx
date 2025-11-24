import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserEvents, CalendarEvent } from '../lib/calendarService'
import { Category } from '../lib/categoryService'
import { EmptyState } from './EmptyState'

interface EventsByAspectProps {
  aspect: Category | null
}

function formatEventTime(startTime: string, endTime: string): string {
  const start = new Date(startTime)
  const end = new Date(endTime)

  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  const startTimeStr = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const endTimeStr = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  return `${dateStr} • ${startTimeStr} - ${endTimeStr}`
}

function EventCard({ event, aspectColor, isDarkMode }: { event: CalendarEvent, aspectColor: string, isDarkMode: boolean }) {
  return (
    <div style={{
      padding: '16px',
      background: isDarkMode ? '#1a1a1a' : '#fff',
      border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
      borderRadius: '8px',
      borderLeft: `4px solid ${aspectColor}`,
      transition: 'all 0.2s'
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isDarkMode ? '#2a2a2a' : '#fafafa'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDarkMode ? '#1a1a1a' : '#fff'
      }}
    >
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: isDarkMode ? '#fff' : '#000',
        marginBottom: '6px'
      }}>
        {event.title}
      </div>

      <div style={{
        fontSize: '12px',
        color: isDarkMode ? '#999' : '#666',
        marginBottom: '8px'
      }}>
        {formatEventTime(event.start_time, event.end_time)}
      </div>

      {event.location && (
        <div style={{
          fontSize: '12px',
          color: isDarkMode ? '#999' : '#666',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>Location:</span>
          {event.location}
        </div>
      )}

      {event.description && (
        <div style={{
          fontSize: '13px',
          color: isDarkMode ? '#ccc' : '#333',
          lineHeight: '1.4',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5'
        }}>
          {event.description}
        </div>
      )}
    </div>
  )
}

export function EventsByAspect({ aspect }: EventsByAspectProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadEvents() {
      if (!user || !session || !aspect) {
        setEvents([])
        return
      }

      setLoading(true)
      try {
        const { events: allEvents } = await fetchUserEvents(user, session.access_token)

        // Filter events by aspect category
        const filteredEvents = allEvents.filter(event =>
          event.category === aspect.name || event.category === aspect.id
        )

        // Sort by start time (most recent first)
        filteredEvents.sort((a, b) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        )

        setEvents(filteredEvents)
      } catch (error) {
        console.error('Error loading events:', error)
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [user, session, aspect])

  if (!aspect) {
    return (
      <EmptyState
        title="No aspect selected"
        description="Select an aspect from the list to view its events"
      />
    )
  }

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: isDarkMode ? '#999' : '#666',
        fontSize: '14px'
      }}>
        Loading events...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No events found"
        description={`No events found for the "${aspect.name}" aspect`}
      />
    )
  }

  // Group events by date
  const eventsByDate: { [key: string]: CalendarEvent[] } = {}
  events.forEach(event => {
    const dateKey = new Date(event.start_time).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = []
    }
    eventsByDate[dateKey].push(event)
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingBottom: '16px',
        borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5'
      }}>
        {aspect.icon && <span style={{ fontSize: '24px' }}>{aspect.icon}</span>}
        <div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: isDarkMode ? '#fff' : '#000',
            margin: '0 0 4px 0'
          }}>
            {aspect.name}
          </h3>
          <div style={{
            fontSize: '13px',
            color: isDarkMode ? '#999' : '#666'
          }}>
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {Object.entries(eventsByDate).map(([date, dateEvents]) => (
          <div key={date}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: isDarkMode ? '#999' : '#666',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {date}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {dateEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  aspectColor={aspect.color || '#999'}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
