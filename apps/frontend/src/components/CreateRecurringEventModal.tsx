import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Modal } from './Modal'
import { createRecurringEvent } from '../lib/calendarService'
import { buildRRuleFromForm, getNextOccurrences } from '../lib/recurrenceUtils'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { SaveTextButton, CancelTextButton } from './ui/IconButtons'

interface CreateRecurringEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  user: User | null
}

type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function CreateRecurringEventModal({ isOpen, onClose, onSuccess, user }: CreateRecurringEventModalProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  // Form state
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState(() => {
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
    return now.toISOString().slice(0, 16)
  })
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

  // Update preview when recurrence changes
  const updatePreview = () => {
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
  }

  useEffect(() => {
    updatePreview()
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

      if (!title.trim()) {
        setError('Event title is required')
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

      const { event, error: createError } = await createRecurringEvent(
        user,
        title.trim(),
        new Date(startTime).toISOString(),
        rrule,
        category || 'Personal',
        description,
        location
      )

      if (createError) {
        setError(createError)
        return
      }

      if (!event) {
        setError('Failed to create recurring event')
        return
      }

      // Reset form
      setTitle('')
      const now = new Date()
      now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
      setStartTime(now.toISOString().slice(0, 16))
      setPattern('weekly')
      setInterval(1)
      setDaysOfWeek(['MO'])
      setDayOfMonth(1)
      setEndType('never')
      setCount(10)
      setUntilDate('')
      setCategory('Personal')
      setDescription('')
      setLocation('')

      onSuccess()
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Recurring Event" maxWidth="500px">
      <form onSubmit={handleSubmit} style={{
        padding: 'clamp(12px, 2.5vh, 20px) clamp(12px, 3vw, 20px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(12px, 2vh, 16px)',
        overflowY: 'auto',
        flex: 1,
        minHeight: 0
      }}>
        {/* Title */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Event Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Team Standup"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: fontSize.base,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px'
            }}
          />
        </div>

        {/* Start Date & Time */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Start Date & Time *
          </label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: fontSize.base,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px'
            }}
          />
        </div>

        {/* Recurrence Pattern */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Recurrence Pattern
          </label>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value as RecurrencePattern)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: fontSize.base,
              background: colors.bgSecondary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px'
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* Interval */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Repeat Every
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: '60px',
                padding: '8px',
                fontSize: fontSize.base,
                background: colors.bgSecondary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                textAlign: 'center'
              }}
            />
            <span style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
              {pattern === 'daily' ? 'day(s)' : pattern === 'weekly' ? 'week(s)' : pattern === 'monthly' ? 'month(s)' : 'year(s)'}
            </span>
          </div>
        </div>

        {/* Days of Week (for weekly) */}
        {pattern === 'weekly' && (
          <div>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Days of Week
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { label: 'Su', value: 'SU' },
                { label: 'M', value: 'MO' },
                { label: 'Tu', value: 'TU' },
                { label: 'W', value: 'WE' },
                { label: 'Th', value: 'TH' },
                { label: 'F', value: 'FR' },
                { label: 'Sa', value: 'SA' }
              ].map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => {
                    if (daysOfWeek.includes(day.value)) {
                      if (daysOfWeek.length > 1) {
                        setDaysOfWeek(daysOfWeek.filter(d => d !== day.value))
                      }
                    } else {
                      setDaysOfWeek([...daysOfWeek, day.value])
                    }
                  }}
                  style={{
                    minWidth: '32px',
                    height: '32px',
                    padding: '0 6px',
                    borderRadius: '16px',
                    border: `1px solid ${daysOfWeek.includes(day.value) ? colors.textPrimary : colors.border}`,
                    background: daysOfWeek.includes(day.value) ? colors.textPrimary : 'transparent',
                    color: daysOfWeek.includes(day.value) ? colors.bgPrimary : colors.textSecondary,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    cursor: 'pointer'
                  }}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Day of Month (for monthly) */}
        {pattern === 'monthly' && (
          <div>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Day of Month
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
              style={{
                width: '60px',
                padding: '8px',
                fontSize: fontSize.base,
                background: colors.bgSecondary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                textAlign: 'center'
              }}
            />
          </div>
        )}

        {/* End Condition */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            End Condition
          </label>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {(['never', 'after', 'until'] as const).map((option) => (
              <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value={option}
                  checked={endType === option}
                  onChange={(e) => setEndType(e.target.value as typeof endType)}
                />
                <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                  {option === 'never' ? 'Never' : option === 'after' ? 'After' : 'Until'}
                </span>
              </label>
            ))}
          </div>

          {endType === 'after' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '60px',
                  padding: '8px',
                  fontSize: fontSize.base,
                  background: colors.bgSecondary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>occurrences</span>
            </div>
          )}

          {endType === 'until' && (
            <input
              type="date"
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
              style={{
                padding: '10px 12px',
                fontSize: fontSize.base,
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px'
              }}
            />
          )}
        </div>

        {/* Category */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Category
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Work"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: fontSize.base,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px'
            }}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={2}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: fontSize.base,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Location */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Optional location"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: fontSize.base,
              background: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px'
            }}
          />
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div style={{
            padding: '10px',
            background: colors.bgSecondary,
            borderRadius: '6px',
            fontSize: fontSize.xs
          }}>
            <p style={{ color: colors.textSecondary, margin: '0 0 6px 0' }}>Next occurrences:</p>
            {preview.map((date, idx) => (
              <div key={idx} style={{ color: colors.textPrimary, marginBottom: '2px' }}>
                • {date.toLocaleString()}
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c33',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          paddingTop: '8px',
          borderTop: `1px solid ${colors.border}`
        }}>
          <CancelTextButton
            onClick={handleClose}
            disabled={loading}
          />
          <SaveTextButton
            onClick={(e) => handleSubmit(e)}
            disabled={!title.trim()}
            loading={loading}
            isCreate
          />
        </div>
      </form>
    </Modal>
  )
}
