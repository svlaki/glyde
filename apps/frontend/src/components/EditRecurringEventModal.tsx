import React, { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Modal } from './Modal'
import { CalendarEvent, updateRecurringEvent } from '../lib/calendarService'
import { buildRRuleFromForm, parseRRuleToForm, getNextOccurrences } from '../lib/recurrenceUtils'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

interface EditRecurringEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  event: CalendarEvent | null
  user: User | null
  accessToken?: string
}

type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function EditRecurringEventModal({
  isOpen,
  onClose,
  onSuccess,
  event,
  user,
  accessToken
}: EditRecurringEventModalProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  // Form state
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [pattern, setPattern] = useState<RecurrencePattern>('weekly')
  const [interval, setInterval] = useState(1)
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(['MO'])
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [endType, setEndType] = useState<'never' | 'after' | 'until'>('never')
  const [count, setCount] = useState(10)
  const [untilDate, setUntilDate] = useState('')
  const [category, setCategory] = useState('Personal')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Date[]>([])

  const dayOptions = [
    { label: 'Monday', value: 'MO' },
    { label: 'Tuesday', value: 'TU' },
    { label: 'Wednesday', value: 'WE' },
    { label: 'Thursday', value: 'TH' },
    { label: 'Friday', value: 'FR' },
    { label: 'Saturday', value: 'SA' },
    { label: 'Sunday', value: 'SU' }
  ]

  // Initialize form with event data when event changes
  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      // Format date for datetime-local input
      if (event.start_time) {
        const date = new Date(event.start_time)
        setStartTime(date.toISOString().slice(0, 16))
      } else {
        const now = new Date()
        setStartTime(now.toISOString().slice(0, 16))
      }
      setCategory(event.category || 'Personal')
      setDescription(event.description || '')
      setLocation(event.location || '')

      // Parse existing RRULE if present
      if (event.recurrence_rule) {
        const parsed = parseRRuleToForm(event.recurrence_rule)
        if (parsed) {
          setPattern(parsed.pattern)
          setInterval(parsed.interval || 1)
          setDaysOfWeek(parsed.daysOfWeek || ['MO'])
          setDayOfMonth(parsed.dayOfMonth || 1)
          setEndType(parsed.endType || 'never')
          setCount(parsed.count || 10)
          setUntilDate(parsed.untilDate ? parsed.untilDate.toISOString().split('T')[0] : '')
        }
      }
    }
  }, [event])

  // Update preview when recurrence changes
  useEffect(() => {
    try {
      if (!startTime) return
      const startDate = new Date(startTime)
      const rrule = buildRRuleFromForm({
        pattern,
        interval,
        daysOfWeek: pattern === 'weekly' ? daysOfWeek : [],
        dayOfMonth: pattern === 'monthly' ? dayOfMonth : 1,
        endType,
        count: endType === 'after' ? count : undefined,
        untilDate: endType === 'until' && untilDate ? new Date(untilDate) : undefined
      })

      const occurrences = getNextOccurrences(rrule, startDate, 5)
      setPreview(occurrences)
    } catch (err) {
      console.error('Error updating preview:', err)
      setPreview([])
    }
  }, [pattern, interval, daysOfWeek, dayOfMonth, endType, count, untilDate, startTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!user) {
        setError('User not authenticated')
        return
      }

      if (!event) {
        setError('No event to update')
        return
      }

      if (!title.trim()) {
        setError('Event title is required')
        return
      }

      // Build RRULE
      const rrule = buildRRuleFromForm({
        pattern,
        interval,
        daysOfWeek: pattern === 'weekly' ? daysOfWeek : [],
        dayOfMonth: pattern === 'monthly' ? dayOfMonth : 1,
        endType,
        count: endType === 'after' ? count : undefined,
        untilDate: endType === 'until' && untilDate ? new Date(untilDate) : undefined
      })

      // Get the parent event ID if this is an instance
      const eventId = event.parent_event_id || event.id

      const { event: updatedEvent, error: updateError } = await updateRecurringEvent(
        user,
        eventId,
        'entire_series',
        {
          title: title.trim(),
          start_time: new Date(startTime).toISOString(),
          recurrence_rule: rrule,
          category: category || 'Personal',
          description,
          location,
          recurrence_end: endType === 'until' && untilDate ? new Date(untilDate).toISOString() : undefined
        },
        accessToken
      )

      if (updateError) {
        setError(updateError)
        return
      }

      if (!updatedEvent) {
        setError('Failed to update recurring event')
        return
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  if (!event) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Recurring Event" maxWidth="700px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Form content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Info banner */}
          <div style={{
            padding: '12px',
            backgroundColor: `${colors.accent}15`,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            <p style={{ color: colors.textSecondary, fontSize: '13px', margin: 0 }}>
              Changes will apply to the entire recurring series.
            </p>
          </div>

          {/* Title */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              Event Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Team Standup"
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Start time */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Recurrence pattern */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              Recurrence Pattern
            </label>
            <select
              value={pattern}
              onChange={(e) => setPattern(e.target.value as RecurrencePattern)}
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Interval */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              Repeat Every
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '80px',
                  padding: '10px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ color: colors.textSecondary }}>
                {pattern === 'daily' ? 'day(s)' : pattern === 'weekly' ? 'week(s)' : pattern === 'monthly' ? 'month(s)' : 'year(s)'}
              </span>
            </div>
          </div>

          {/* Days of week (for weekly) */}
          {pattern === 'weekly' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
                Days of Week
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                {dayOptions.map((day) => (
                  <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={daysOfWeek.includes(day.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDaysOfWeek([...daysOfWeek, day.value])
                        } else {
                          setDaysOfWeek(daysOfWeek.filter((d) => d !== day.value))
                        }
                      }}
                    />
                    <span style={{ color: colors.textPrimary, fontSize: '14px' }}>{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Day of month (for monthly) */}
          {pattern === 'monthly' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
                Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                style={{
                  width: '100px',
                  padding: '10px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* End condition */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              End Condition
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {(['never', 'after', 'until'] as const).map((option) => (
                <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value={option}
                    checked={endType === option}
                    onChange={(e) => setEndType(e.target.value as typeof endType)}
                  />
                  <span style={{ color: colors.textPrimary, fontSize: '14px' }}>
                    {option === 'never' ? 'Never' : option === 'after' ? 'After N occurrences' : 'Until date'}
                  </span>
                </label>
              ))}
            </div>

            {endType === 'after' && (
              <input
                type="number"
                min="1"
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Number of occurrences"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            )}

            {endType === 'until' && (
              <input
                type="date"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  marginTop: '10px'
                }}
              />
            )}
          </div>

          {/* Category */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Work"
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Location */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: colors.textPrimary, fontWeight: '500' }}>
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional location"
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div style={{
              padding: '12px',
              backgroundColor: `${colors.accent}15`,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <p style={{ color: colors.textSecondary, fontSize: '12px', margin: '0 0 8px 0' }}>Next occurrences:</p>
              {preview.map((date, idx) => (
                <div key={idx} style={{ color: colors.textPrimary, fontSize: '13px', marginBottom: '4px' }}>
                  {date.toLocaleString()}
                </div>
              ))}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '6px',
              marginBottom: '20px',
              color: '#c33',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Form footer with buttons */}
        <div style={{
          padding: '20px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '10px 16px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: colors.textPrimary,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: colors.accent,
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
