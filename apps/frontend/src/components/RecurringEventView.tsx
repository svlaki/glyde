import React, { useState, useEffect } from 'react'
import { CalendarEvent } from '../lib/calendarService'
import { getColors } from '../styles/colors'
import { useDarkMode } from '../lib/darkModeContext'
import { formatRRuleForDisplay, getNextOccurrences, isRecurringInstance } from '../lib/recurrenceUtils'
import { Modal } from './Modal'

interface RecurringEventViewProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onEdit: (event: CalendarEvent, scope: 'this_instance' | 'entire_series') => void
  onDelete: (event: CalendarEvent, scope: 'this_instance' | 'entire_series') => void
}

/**
 * Component to view and manage a recurring event
 * Shows the event details, recurrence pattern, and options to edit/delete
 * either this instance or the entire series
 */
export function RecurringEventView({
  event,
  isOpen,
  onClose,
  onEdit,
  onDelete
}: RecurringEventViewProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const [action, setAction] = useState<'view' | 'choose_edit_scope' | 'choose_delete_scope'>('view')
  const [nextOccurrences, setNextOccurrences] = useState<Date[]>([])

  // Update next occurrences when event changes
  useEffect(() => {
    if (event && event.recurrence_rule) {
      try {
        const occurrences = getNextOccurrences(event.recurrence_rule, new Date(event.start_time), 5)
        setNextOccurrences(occurrences)
      } catch (err) {
        console.error('Error getting next occurrences:', err)
        setNextOccurrences([])
      }
    }
  }, [event])

  const handleClose = () => {
    setAction('view')
    onClose()
  }

  const handleEditClick = () => {
    setAction('choose_edit_scope')
  }

  const handleDeleteClick = () => {
    setAction('choose_delete_scope')
  }

  const handleScopeChoice = (scope: 'this_instance' | 'entire_series') => {
    if (!event) return
    if (action === 'choose_delete_scope') {
      onDelete(event, scope)
    } else {
      onEdit(event, scope)
    }
    handleClose()
  }

  if (!event || (!event.is_recurring && !event.parent_event_id)) {
    return null
  }

  const isInstance = isRecurringInstance(event)
  const startTime = new Date(event.start_time)
  const endTime = new Date(event.end_time)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Recurring Event" maxWidth="600px">
      {action === 'view' ? (
        // View Mode
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Event Title */}
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: colors.textPrimary }}>
              {event.title}
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                ⏰ {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {event.category && (
                <div style={{
                  fontSize: '12px',
                  padding: '3px 8px',
                  backgroundColor: `${colors.accent}20`,
                  color: colors.textPrimary,
                  borderRadius: '4px'
                }}>
                  {event.category}
                </div>
              )}
            </div>
          </div>

          {/* Recurrence Information */}
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
              Recurrence
            </h4>

            {event.recurrence_rule && (
              <div style={{ fontSize: '14px', color: colors.textPrimary, marginBottom: '12px' }}>
                <strong>Pattern:</strong> {formatRRuleForDisplay(event.recurrence_rule)}
              </div>
            )}

            {isInstance && event.parent_event_id && (
              <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '12px' }}>
                💡 This is an instance of a recurring series. You can edit or delete just this event, or modify the entire series.
              </div>
            )}

            {!isInstance && (
              <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '12px' }}>
                📅 This is the parent recurring event. Changes to the series will affect all future instances.
              </div>
            )}
          </div>

          {/* Next Occurrences Preview */}
          {nextOccurrences.length > 0 && (
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Upcoming Instances
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {nextOccurrences.map((date, idx) => {
                  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={idx} style={{ fontSize: '13px', color: colors.textPrimary }}>
                      {dateStr} at {timeStr}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Description
              </h4>
              <p style={{ margin: 0, fontSize: '14px', color: colors.textPrimary, whiteSpace: 'pre-wrap' }}>
                {event.description}
              </p>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Location
              </h4>
              <p style={{ margin: 0, fontSize: '14px', color: colors.textPrimary }}>
                📍 {event.location}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            borderTop: `1px solid ${colors.border}`,
            paddingTop: '16px',
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleClose}
              style={{
                padding: '10px 16px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: colors.textPrimary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Close
            </button>
            <button
              onClick={handleEditClick}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: colors.accent,
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Edit
            </button>
            <button
              onClick={handleDeleteClick}
              style={{
                padding: '10px 16px',
                border: `1px solid #ef4444`,
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        // Scope Selection Mode
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: colors.textPrimary }}>
            Would you like to {action === 'choose_delete_scope' ? 'delete' : 'edit'} this event instance or the entire recurring series?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* This Instance Option */}
            {isInstance && (
              <button
                onClick={() => handleScopeChoice('this_instance')}
                style={{
                  padding: '16px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bgHover
                  e.currentTarget.style.borderColor = colors.accent
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bgPrimary
                  e.currentTarget.style.borderColor = colors.border
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  📍 This Instance Only
                </div>
                <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                  Affects only this {startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} instance
                </div>
              </button>
            )}

            {/* Entire Series Option */}
            <button
              onClick={() => handleScopeChoice('entire_series')}
              style={{
                padding: '16px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bgHover
                e.currentTarget.style.borderColor = colors.accent
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bgPrimary
                e.currentTarget.style.borderColor = colors.border
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                ♻️ Entire Series
              </div>
              <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                Affects all instances of this recurring event
              </div>
            </button>
          </div>

          {/* Cancel Button */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button
              onClick={() => setAction('view')}
              style={{
                padding: '10px 16px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: colors.textPrimary,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
