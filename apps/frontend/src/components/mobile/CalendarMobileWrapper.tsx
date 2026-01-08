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
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

  // // Navigation functions
  // const handlePrev = () => {
  //   const newDate = new Date(currentDate)
  //   if (view === 'day') {
  //     newDate.setDate(currentDate.getDate() - 1)
  //   } else {
  //     newDate.setMonth(currentDate.getMonth() - 1)
  //   }
  //   setCurrentDate(newDate)
  // }

  // const handleNext = () => {
  //   const newDate = new Date(currentDate)
  //   if (view === 'day') {
  //     newDate.setDate(currentDate.getDate() + 1)
  //   } else {
  //     newDate.setMonth(currentDate.getMonth() + 1)
  //   }
  //   setCurrentDate(newDate)
  // }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Format the date header
  const getDateHeader = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    } else {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: 0 }}>
      {/* Date header with menu button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button
          onClick={() => setIsMenuOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textPrimary,
            fontSize: '22px',
            padding: '4px',
            cursor: 'pointer',
            minWidth: '32px',
            minHeight: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ☰
        </button>
        <h2 style={{
          fontSize: '22px',
          fontWeight: '700',
          color: colors.textPrimary,
          margin: 0,
          letterSpacing: '-0.02em',
          flex: 1
        }}>
          {getDateHeader()}
        </h2>
      </div>

      {/* Controls row - View toggle on left, Navigation on right */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* View toggle - compressed */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '2px',
          background: colors.bgSecondary,
          borderRadius: '6px',
          flexShrink: 0
        }}>
          <button
            onClick={() => setView('day')}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              background: view === 'day' ? colors.bgHover : 'transparent',
              color: colors.textPrimary,
              fontSize: '12px',
              fontWeight: view === 'day' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Day
          </button>
          <button
            onClick={() => setView('month')}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              background: view === 'month' ? colors.bgHover : 'transparent',
              color: colors.textPrimary,
              fontSize: '12px',
              fontWeight: view === 'month' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Month
          </button>
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* <button
            onClick={handlePrev}
            style={{
              padding: '6px 10px',
              background: colors.bgSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.textPrimary,
              cursor: 'pointer',
              fontSize: '14px',
              minHeight: '32px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ←
          </button> */}
          <button
            onClick={handleToday}
            style={{
              padding: '6px 12px',
              background: colors.bgSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.textPrimary,
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              minHeight: '32px'
            }}
          >
            Today
          </button>
          {/* <button
            onClick={handleNext}
            style={{
              padding: '6px 10px',
              background: colors.bgSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.textPrimary,
              cursor: 'pointer',
              fontSize: '14px',
              minHeight: '32px',
              minWidth: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            →
          </button> */}
        </div>
      </div>

      {/* Day switcher - only shown in day view */}
      {view === 'day' && (
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          marginLeft: '0',
          marginRight: '0',
          paddingLeft: '0',
          paddingRight: '0'
        }}>
          {weekDays.map((day, index) => {
            const selected = isSameDay(day, currentDate)
            const today = isToday(day)

            return (
              <button
                key={index}
                onClick={() => setCurrentDate(day)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '6px 10px',
                  border: `1.5px solid ${selected ? colors.textPrimary : colors.border}`,
                  borderRadius: '8px',
                  background: selected ? colors.bgHover : colors.bgSecondary,
                  color: today ? colors.textPrimary : colors.textSecondary,
                  cursor: 'pointer',
                  minWidth: '44px',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  fontWeight: selected ? '600' : '400'
                }}
              >
                <span style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{dayNames[index]}</span>
                <span style={{ fontSize: '15px', fontWeight: '600' }}>{day.getDate()}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Mobile Calendar */}
      <div style={{ flex: 1, minHeight: 0 }}>
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
