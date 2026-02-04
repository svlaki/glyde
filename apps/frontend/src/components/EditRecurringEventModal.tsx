import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Modal } from './Modal'
import { CalendarEvent, updateRecurringEvent } from '../lib/calendarService'
import { buildRRuleFromForm, parseRRuleToForm, getNextOccurrences } from '../lib/recurrenceUtils'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { SaveTextButton, CancelTextButton } from './ui/IconButtons'

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
    { label: 'Su', value: 'SU' },
    { label: 'M', value: 'MO' },
    { label: 'Tu', value: 'TU' },
    { label: 'W', value: 'WE' },
    { label: 'Th', value: 'TH' },
    { label: 'F', value: 'FR' },
    { label: 'Sa', value: 'SA' }
  ]

  // Initialize form with event data when event changes
  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      if (event.start_time) {
        const date = new Date(event.start_time)
        setStartTime(date.toISOString().slice(0, 16))
      }
      setCategory(event.category || 'Personal')
      setDescription(event.description || '')
      setLocation(event.location || '')

      if (event.recurrence_rule) {
        const parsed = parseRRuleToForm(event.recurrence_rule)
        if (parsed) {
          setPattern(parsed.pattern)
          setInterval(parsed.interval || 1)
          setDaysOfWeek(parsed.daysOfWeek || ['MO'])
          setDayOfMonth(parsed.dayOfMonth || 1)
          setEndType(parsed.endType || 'never')
          setCount(parsed.count || 10)
          // Check if untilDate is a valid Date before calling toISOString
          if (parsed.untilDate && parsed.untilDate instanceof Date && !isNaN(parsed.untilDate.getTime())) {
            setUntilDate(parsed.untilDate.toISOString().split('T')[0])
          } else {
            setUntilDate('')
          }
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
        setLoading(false)
        return
      }

      if (!event) {
        setError('No event to update')
        setLoading(false)
        return
      }

      if (!title.trim()) {
        setError('Event title is required')
        setLoading(false)
        return
      }

      const rrule = buildRRuleFromForm({
        pattern,
        interval,
        daysOfWeek: pattern === 'weekly' ? daysOfWeek : [],
        dayOfMonth: pattern === 'monthly' ? dayOfMonth : 1,
        endType,
        count: endType === 'after' ? count : undefined,
        untilDate: endType === 'until' && untilDate ? new Date(untilDate) : undefined
      })

      const eventId = event.parent_event_id || event.id

      const { error: updateError } = await updateRecurringEvent(
        user,
        eventId,
        'entire_series',
        {
          title: title.trim(),
          start_time: new Date(startTime).toISOString(),
          recurrence_rule: rrule,
          category: category || 'Personal',
          description,
          location
        },
        accessToken
      )

      if (updateError) {
        setError(updateError)
        setLoading(false)
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

  const toggleDay = (dayValue: string) => {
    if (daysOfWeek.includes(dayValue)) {
      if (daysOfWeek.length > 1) {
        setDaysOfWeek(daysOfWeek.filter(d => d !== dayValue))
      }
    } else {
      setDaysOfWeek([...daysOfWeek, dayValue])
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    boxSizing: 'border-box' as const
  }

  const labelStyle = {
    display: 'block',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as const,
    color: colors.textSecondary,
    marginBottom: '6px'
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Recurring Event" maxWidth="500px">
      <form onSubmit={handleSubmit} style={{
        padding: 'clamp(12px, 2.5vh, 20px) clamp(12px, 3vw, 20px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(12px, 2vh, 16px)',
        overflowY: 'auto',
        flex: 1,
        minHeight: 0
      }}>
        {/* Info banner */}
        <div style={{
          padding: '12px',
          backgroundColor: colors.bgTertiary,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px'
        }}>
          <p style={{ color: colors.textSecondary, fontSize: fontSize.sm, margin: 0 }}>
            Changes will apply to the entire recurring series.
          </p>
        </div>

        {/* Title */}
        <div>
          <label style={labelStyle}>Event Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Team Standup"
            style={inputStyle}
          />
        </div>

        {/* Start time */}
        <div>
          <label style={labelStyle}>Start Date & Time *</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Recurrence pattern */}
        <div>
          <label style={labelStyle}>Recurrence Pattern</label>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value as RecurrencePattern)}
            style={inputStyle}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* Interval */}
        <div>
          <label style={labelStyle}>Repeat Every</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ ...inputStyle, width: '80px' }}
            />
            <span style={{ color: colors.textSecondary }}>
              {pattern === 'daily' ? 'day(s)' : pattern === 'weekly' ? 'week(s)' : pattern === 'monthly' ? 'month(s)' : 'year(s)'}
            </span>
          </div>
        </div>

        {/* Days of week (for weekly) */}
        {pattern === 'weekly' && (
          <div>
            <label style={labelStyle}>Days of Week</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {dayOptions.map((day) => {
                const isSelected = daysOfWeek.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: `1px solid ${isSelected ? colors.textPrimary : colors.border}`,
                      backgroundColor: isSelected ? colors.textPrimary : 'transparent',
                      color: isSelected ? colors.bgPrimary : colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium
                    }}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Day of month (for monthly) */}
        {pattern === 'monthly' && (
          <div>
            <label style={labelStyle}>Day of Month</label>
            <input
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
              style={{ ...inputStyle, width: '100px' }}
            />
          </div>
        )}

        {/* End condition */}
        <div>
          <label style={labelStyle}>End Condition</label>
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
              style={inputStyle}
            />
          )}

          {endType === 'until' && (
            <input
              type="date"
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Work"
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>

        {/* Location */}
        <div>
          <label style={labelStyle}>Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Optional location"
            style={inputStyle}
          />
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div style={{
            padding: '12px',
            backgroundColor: colors.bgTertiary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px'
          }}>
            <p style={{ color: colors.textSecondary, fontSize: fontSize.xs, margin: '0 0 8px 0' }}>Next occurrences:</p>
            {preview.map((date, idx) => (
              <div key={idx} style={{ color: colors.textPrimary, fontSize: fontSize.sm, marginBottom: '4px' }}>
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
            color: '#c33',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px' }}>
          <CancelTextButton
            onClick={handleClose}
            disabled={loading}
          />
          <SaveTextButton
            onClick={(e) => handleSubmit(e)}
            disabled={!title.trim()}
            loading={loading}
          />
        </div>
      </form>
    </Modal>
  )
}
