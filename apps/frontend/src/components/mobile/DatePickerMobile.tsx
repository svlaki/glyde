import { useState } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'

interface DatePickerMobileProps {
  value: Date
  onChange: (date: Date) => void
  isOpen: boolean
  onClose: () => void
}

export function DatePickerMobile({ value, onChange, isOpen, onClose }: DatePickerMobileProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [viewDate, setViewDate] = useState(value || new Date())

  if (!isOpen) return null

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  // Get days for the month grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const days: (number | null)[] = []
  // Add empty slots for days before the first
  for (let i = 0; i < startDay; i++) {
    days.push(null)
  }
  // Add the days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
  }

  const isSelected = (day: number) => {
    return day === value.getDate() &&
      month === value.getMonth() &&
      year === value.getFullYear()
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(value)
    newDate.setFullYear(year, month, day)
    onChange(newDate)
    onClose()
  }

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bgSecondary,
          borderRadius: '16px',
          padding: '16px',
          width: '100%',
          maxWidth: '320px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Month/Year Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <button
            onClick={prevMonth}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              color: colors.textPrimary,
              cursor: 'pointer',
              padding: '8px',
              minWidth: '44px',
              minHeight: '44px'
            }}
          >
            ‹
          </button>
          <span style={{
            fontSize: '16px',
            fontWeight: '600',
            color: colors.textPrimary
          }}>
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              color: colors.textPrimary,
              cursor: 'pointer',
              padding: '8px',
              minWidth: '44px',
              minHeight: '44px'
            }}
          >
            ›
          </button>
        </div>

        {/* Day Names */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          marginBottom: '8px'
        }}>
          {dayNames.map(day => (
            <div key={day} style={{
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textSecondary,
              padding: '4px'
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px'
        }}>
          {days.map((day, idx) => (
            <div
              key={idx}
              onClick={() => day && handleDayClick(day)}
              style={{
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: day && isSelected(day) ? '600' : '400',
                color: day ? (isSelected(day) ? '#fff' : colors.textPrimary) : 'transparent',
                background: day && isSelected(day) ? '#000' : (day && isToday(day) ? colors.bgHover : 'transparent'),
                borderRadius: '50%',
                cursor: day ? 'pointer' : 'default',
                border: day && isToday(day) && !isSelected(day) ? `1px solid ${colors.textSecondary}` : 'none'
              }}
            >
              {day || ''}
            </div>
          ))}
        </div>

        {/* Today Button */}
        <button
          onClick={() => {
            const today = new Date()
            const newDate = new Date(value)
            newDate.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
            onChange(newDate)
            onClose()
          }}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.textPrimary,
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Today
        </button>
      </div>
    </div>
  )
}
