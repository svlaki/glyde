import { useState } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { MobileCalendar } from './MobileCalendar'
import { MobileMenu } from './MobileMenu'

export function CalendarMobileWrapper() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'day' | 'month'>('day')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Get the days of the week for the day switcher
  const getWeekDays = () => {
    const week = []
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  const weekDays = getWeekDays()
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] // Single letter like Apple Calendar

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
  }

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Format the date header
  const getDateHeader = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      })
    } else {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      })
    }
  }

  // Compact button style shared between toggle and Today
  const compactButtonStyle = {
    padding: '4px 10px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'all 0.15s',
    minHeight: '28px'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header row: Menu + Date + Toggle + Today */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}>
        {/* Menu button */}
        <button
          onClick={() => setIsMenuOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textPrimary,
            fontSize: '20px',
            padding: '2px',
            cursor: 'pointer',
            minWidth: '28px',
            minHeight: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ☰
        </button>

        {/* Date title */}
        <h2 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: colors.textPrimary,
          margin: 0,
          letterSpacing: '-0.02em',
          flex: 1
        }}>
          {getDateHeader()}
        </h2>

        {/* View toggle */}
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '2px',
          background: colors.bgSecondary,
          borderRadius: '6px'
        }}>
          <button
            onClick={() => setView('day')}
            style={{
              ...compactButtonStyle,
              background: view === 'day' ? colors.bgHover : 'transparent',
              color: colors.textPrimary,
              fontWeight: view === 'day' ? '600' : '400'
            }}
          >
            Day
          </button>
          <button
            onClick={() => setView('month')}
            style={{
              ...compactButtonStyle,
              background: view === 'month' ? colors.bgHover : 'transparent',
              color: colors.textPrimary,
              fontWeight: view === 'month' ? '600' : '400'
            }}
          >
            Month
          </button>
        </div>

        {/* Today button */}
        <button
          onClick={handleToday}
          style={{
            ...compactButtonStyle,
            background: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            borderRadius: '6px'
          }}
        >
          Today
        </button>
      </div>

      {/* Day picker - compact Apple-style (only shown in day view) */}
      {view === 'day' && (
        <div style={{
          display: 'flex',
          marginBottom: '8px'
        }}>
          {weekDays.map((day, index) => {
            const selected = isSameDay(day, currentDate)
            const today = isToday(day)

            return (
              <button
                key={index}
                onClick={() => setCurrentDate(day)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '4px 0',
                  border: 'none',
                  background: 'transparent',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {/* Day letter */}
                <span style={{
                  fontSize: '10px',
                  fontWeight: '500',
                  color: colors.textTertiary,
                  textTransform: 'uppercase'
                }}>
                  {dayNames[index]}
                </span>
                {/* Date number */}
                <span style={{
                  fontSize: '17px',
                  fontWeight: selected || today ? '600' : '400',
                  color: selected
                    ? '#fff'
                    : today
                      ? '#ef4444'
                      : colors.textSecondary,
                  background: selected
                    ? '#ef4444'
                    : 'transparent',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {day.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Mobile Calendar - scrollable area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <MobileCalendar
          view={view}
          currentDate={currentDate}
          onDateChange={(date) => {
            setCurrentDate(date)
            // When clicking a day in month view, switch to day view
            if (view === 'month') {
              setView('day')
            }
          }}
        />
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}
