import { useState, useRef, useEffect } from 'react'
import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
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

  // Track if we're currently sliding to prevent multiple navigations
  const isSliding = useRef(false)

  // Refs to avoid stale closure in keen-slider callbacks
  const currentDateRef = useRef(currentDate)
  const viewRef = useRef(view)

  // Keep refs in sync with state
  useEffect(() => {
    currentDateRef.current = currentDate
  }, [currentDate])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Helper function to navigate by offset
  const navigateByOffset = (offset: number) => {
    const newDate = new Date(currentDateRef.current)
    if (viewRef.current === 'day') {
      newDate.setDate(newDate.getDate() + (offset * 7)) // ±1 week
    } else {
      newDate.setMonth(newDate.getMonth() + offset) // ±1 month
    }
    setCurrentDate(newDate)
  }

  // Week header slider (for day view swipe navigation)
  const [weekSliderRef] = useKeenSlider<HTMLDivElement>({
    initial: 1,
    slides: { perView: 1 },
    rubberband: false,
    slideChanged(slider) {
      if (isSliding.current) return
      isSliding.current = true

      const slideIndex = slider.track.details.rel
      if (slideIndex === 0) {
        navigateByOffset(-1)
      } else if (slideIndex === 2) {
        navigateByOffset(1)
      }

      setTimeout(() => {
        slider.moveToIdx(1, true, { duration: 0 })
        isSliding.current = false
      }, 50)
    },
  })

  // Month view slider (swipe on entire month grid)
  const [monthSliderRef] = useKeenSlider<HTMLDivElement>({
    initial: 1,
    slides: { perView: 1 },
    rubberband: false,
    slideChanged(slider) {
      if (isSliding.current) return
      isSliding.current = true

      const slideIndex = slider.track.details.rel
      if (slideIndex === 0) {
        navigateByOffset(-1)
      } else if (slideIndex === 2) {
        navigateByOffset(1)
      }

      setTimeout(() => {
        slider.moveToIdx(1, true, { duration: 0 })
        isSliding.current = false
      }, 50)
    },
  })

  // Get the days of the week for a given date
  const getWeekDays = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  // Get offset date for slider slides
  const getOffsetDate = (offset: number) => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + (offset * 7))
    } else {
      newDate.setMonth(newDate.getMonth() + offset)
    }
    return newDate
  }

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

  const getDateHeader = () => {
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  }

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

  // Render a single week row with day letters AND date numbers
  const renderWeekRow = (weekDate: Date) => {
    const weekDays = getWeekDays(weekDate)
    return (
      <div style={{ display: 'flex', width: '100%' }}>
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
              {/* Date number with circle for selected/today */}
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
    )
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

      {view === 'day' ? (
        <>
          {/* Week header with swipe - ONLY this part is swipeable */}
          <div
            ref={weekSliderRef}
            className="keen-slider"
            style={{ marginBottom: '8px', overflow: 'hidden', minHeight: '60px' }}
          >
            <div className="keen-slider__slide">
              {renderWeekRow(getOffsetDate(-1))}
            </div>
            <div className="keen-slider__slide">
              {renderWeekRow(currentDate)}
            </div>
            <div className="keen-slider__slide">
              {renderWeekRow(getOffsetDate(1))}
            </div>
          </div>

          {/* Calendar body - NOT swipeable, single instance */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MobileCalendar
              view="day"
              currentDate={currentDate}
              onDateChange={(date) => setCurrentDate(date)}
            />
          </div>
        </>
      ) : (
        /* Month view - entire grid is swipeable */
        <div
          ref={monthSliderRef}
          className="keen-slider"
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <div className="keen-slider__slide" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MobileCalendar
              view="month"
              currentDate={getOffsetDate(-1)}
              onDateChange={(date) => {
                setCurrentDate(date)
                setView('day')
              }}
            />
          </div>
          <div className="keen-slider__slide" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MobileCalendar
              view="month"
              currentDate={currentDate}
              onDateChange={(date) => {
                setCurrentDate(date)
                setView('day')
              }}
            />
          </div>
          <div className="keen-slider__slide" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MobileCalendar
              view="month"
              currentDate={getOffsetDate(1)}
              onDateChange={(date) => {
                setCurrentDate(date)
                setView('day')
              }}
            />
          </div>
        </div>
      )}

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}
