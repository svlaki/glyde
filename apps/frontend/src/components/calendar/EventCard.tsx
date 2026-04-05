import { memo } from 'react'
import type { CalendarEvent } from '../../lib/calendarService'
import { hexToRgba } from '../../styles/colors'
import { getRecurrenceBadge } from '../../lib/recurrenceUtils'
interface EventLayout {
  width: string
  left: string
  right: string
  zIndex: number
}

interface EventCardProps {
  event: CalendarEvent
  eventColor: string
  layout: EventLayout
  top: number
  height: number
  isFriendEvent: boolean
  isShared: boolean
  isViewerEvent: boolean
  isPast: boolean
  isDragSource: boolean
  typography: Record<string, any>
  fontFamily: Record<string, string>
  fontSize: Record<string, string>
  fontWeight: Record<string, number>
  onSelect: (event: CalendarEvent) => void
  onPointerDown?: (e: React.PointerEvent, eventId: string) => void
  isPointerDragging: boolean
  wasDragRef: React.MutableRefObject<boolean>
}

export const EventCard = memo(function EventCard({
  event,
  eventColor,
  layout,
  top,
  height,
  isFriendEvent,
  isShared,
  isViewerEvent,
  isPast,
  isDragSource,
  typography,
  fontFamily: ff,
  fontSize: fs,
  fontWeight: fw,
  onSelect,
  onPointerDown,
  isPointerDragging,
  wasDragRef,
}: EventCardProps) {
  const startTime = new Date(event.start_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  return (
    <div
      data-event-id={event.id}
      onPointerDown={(e) => {
        if (!isFriendEvent && !isViewerEvent && onPointerDown) {
          onPointerDown(e, event.id)
        }
      }}
      onClick={(e) => {
        if (isPointerDragging || wasDragRef.current) {
          wasDragRef.current = false
          return
        }
        e.stopPropagation()
        onSelect(event)
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
        cursor: (isFriendEvent || isViewerEvent) ? 'pointer' : 'grab',
        transition: 'background 0.15s ease, opacity 0.15s ease, transform 0.15s ease',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '2px',
        opacity: isDragSource ? 0.3 : (isFriendEvent ? 0.7 : 1),
        transform: isDragSource ? 'scale(0.97)' : 'none',
        touchAction: 'none',
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
        fontWeight: fw.semibold,
        color: eventColor,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
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
        {isShared && (
          <span style={{
            fontSize: '7px',
            fontFamily: ff.sans,
            fontWeight: fw.semibold,
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
      {!isFriendEvent && isPast && event.is_missed && (
        <span style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#ef4444',
          flexShrink: 0
        }} />
      )}
      {height > 30 && (
        <div style={{
          fontSize: fs.xs,
          fontFamily: ff.sans,
          color: eventColor,
          opacity: 0.8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {isFriendEvent ? `${event.owner_display_name || 'Friend'} - ${startTime}` : startTime}
        </div>
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
})
