import { useEffect, useRef } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { fontSize, fontWeight } from '../../styles/typography'
import { RecurrenceState } from './useEventFormState'

interface RecurrencePopoverProps {
  isOpen: boolean
  onClose: () => void
  onRemove: () => void
  value: RecurrenceState
  onChange: (state: RecurrenceState) => void
  preview: Date[]
}

export function RecurrencePopover({
  isOpen,
  onClose,
  onRemove,
  value,
  onChange,
  preview
}: RecurrencePopoverProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const update = (updates: Partial<RecurrenceState>) => {
    onChange({ ...value, ...updates })
  }

  const dayOptions = [
    { label: 'S', value: 'SU' },
    { label: 'M', value: 'MO' },
    { label: 'T', value: 'TU' },
    { label: 'W', value: 'WE' },
    { label: 'T', value: 'TH' },
    { label: 'F', value: 'FR' },
    { label: 'S', value: 'SA' }
  ]

  const toggleDay = (dayValue: string) => {
    if (value.daysOfWeek.includes(dayValue)) {
      if (value.daysOfWeek.length > 1) {
        update({ daysOfWeek: value.daysOfWeek.filter(d => d !== dayValue) })
      }
    } else {
      update({ daysOfWeek: [...value.daysOfWeek, dayValue] })
    }
  }

  const compactInput: React.CSSProperties = {
    padding: '5px 8px',
    fontSize: fontSize.sm,
    background: colors.bgSecondary,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '5px',
    textAlign: 'center' as const
  }

  const inlineLabel: React.CSSProperties = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    flexShrink: 0
  }

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        padding: '10px 12px',
        background: colors.bgPrimary,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        boxShadow: isDarkMode
          ? '0 6px 20px rgba(0,0,0,0.4)'
          : '0 6px 20px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {/* Repeat every — inline: label [#] [pattern] */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={inlineLabel}>Every</span>
        <input
          type="number"
          min="1"
          value={value.interval}
          onChange={(e) => update({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
          style={{ ...compactInput, width: '48px' }}
        />
        <select
          value={value.pattern}
          onChange={(e) => update({ pattern: e.target.value as RecurrenceState['pattern'] })}
          style={{ ...compactInput, flex: 1, textAlign: 'left' as const }}
        >
          <option value="daily">Day{value.interval > 1 ? 's' : ''}</option>
          <option value="weekly">Week{value.interval > 1 ? 's' : ''}</option>
          <option value="monthly">Month{value.interval > 1 ? 's' : ''}</option>
          <option value="yearly">Year{value.interval > 1 ? 's' : ''}</option>
        </select>
      </div>

      {/* Days of week (weekly only) — inline: label + day pills */}
      {value.pattern === 'weekly' && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={inlineLabel}>On</span>
          {dayOptions.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: `1px solid ${value.daysOfWeek.includes(day.value) ? colors.textPrimary : colors.border}`,
                background: value.daysOfWeek.includes(day.value) ? colors.textPrimary : 'transparent',
                color: value.daysOfWeek.includes(day.value) ? colors.bgPrimary : colors.textSecondary,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1
              }}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      {/* Day of month (monthly only) — inline */}
      {value.pattern === 'monthly' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={inlineLabel}>On day</span>
          <input
            type="number"
            min="1"
            max="31"
            value={value.dayOfMonth}
            onChange={(e) => update({ dayOfMonth: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) })}
            style={{ ...compactInput, width: '48px' }}
          />
        </div>
      )}

      {/* End condition — inline radios with conditional input on same row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={inlineLabel}>Ends</span>
        {(['never', 'after', 'until'] as const).map((option) => (
          <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
            <input
              type="radio"
              value={option}
              checked={value.endType === option}
              onChange={(e) => update({ endType: e.target.value as RecurrenceState['endType'] })}
              style={{ margin: 0, width: '14px', height: '14px' }}
            />
            <span style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>
              {option === 'never' ? 'Never' : option === 'after' ? 'After' : 'On'}
            </span>
          </label>
        ))}
        {value.endType === 'after' && (
          <>
            <input
              type="number"
              min="1"
              value={value.count}
              onChange={(e) => update({ count: Math.max(1, parseInt(e.target.value) || 1) })}
              style={{ ...compactInput, width: '48px' }}
            />
            <span style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>times</span>
          </>
        )}
        {value.endType === 'until' && (
          <input
            type="date"
            value={value.untilDate}
            onChange={(e) => update({ untilDate: e.target.value })}
            style={{ ...compactInput, textAlign: 'left' as const }}
          />
        )}
      </div>

      {/* Preview — condensed single line per date */}
      {preview.length > 0 && (
        <div style={{
          padding: '6px 8px',
          background: colors.bgSecondary,
          borderRadius: '5px',
          fontSize: fontSize.xs,
          color: colors.textSecondary,
          lineHeight: 1.5
        }}>
          <span style={{ fontWeight: fontWeight.medium }}>Next: </span>
          {preview.map((date, idx) => (
            <span key={idx}>
              {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {idx < preview.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Remove recurrence */}
      <button
        type="button"
        onClick={() => {
          onRemove()
          onClose()
        }}
        style={{
          padding: '5px 10px',
          background: 'transparent',
          border: 'none',
          borderTop: `1px solid ${colors.border}`,
          borderRadius: 0,
          color: colors.error,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          cursor: 'pointer',
          marginTop: '-2px',
          paddingTop: '8px'
        }}
      >
        Remove recurrence
      </button>
    </div>
  )
}
