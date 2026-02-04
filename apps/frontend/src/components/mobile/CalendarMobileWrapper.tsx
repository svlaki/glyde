import { useState, useRef, useEffect } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { mobileHeaderStyles } from '../../styles/mobileStyles'
import { MobileCalendar } from './MobileCalendar'
import { MobileMenu } from './MobileMenu'

export function CalendarMobileWrapper() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const typography = getTypography(true) // Mobile context
  const [currentDate, setCurrentDate] = useState(new Date())
  const [displayDate, setDisplayDate] = useState(new Date())  // For header display during scroll
  const [view, setView] = useState<'day' | '3day' | 'month'>('3day')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollToDate, setScrollToDate] = useState<Date | null>(null)  // For scrolling within buffer

  // Refs for scroll containers
  const dayScrollRef = useRef<HTMLDivElement>(null)
  const monthScrollRef = useRef<HTMLDivElement>(null)
  const lastScrollUpdateRef = useRef(0)
  const isSnappingRef = useRef(false)

  // Restore saved state on mount
  useEffect(() => {
    const savedView = localStorage.getItem('calendar-view')
    const savedDate = localStorage.getItem('calendar-date')
    if (savedView === '3day' || savedView === 'month') {
      setView(savedView)
    }
    if (savedDate) {
      const date = new Date(savedDate)
      if (!isNaN(date.getTime())) {
        setCurrentDate(date)
      }
    }
  }, [])

  // Save state when it changes
  useEffect(() => {
    localStorage.setItem('calendar-view', view)
    localStorage.setItem('calendar-date', currentDate.toISOString())
  }, [view, currentDate])

  // Sync displayDate when currentDate changes (e.g., re-centering or Today button)
  useEffect(() => {
    setDisplayDate(currentDate)
  }, [currentDate])

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Check if today is within the current buffer (±30 days of currentDate)
    const bufferCenter = new Date(currentDate)
    bufferCenter.setHours(0, 0, 0, 0)
    const daysDiff = Math.round((today.getTime() - bufferCenter.getTime()) / (1000 * 60 * 60 * 24))

    if (view === '3day' && Math.abs(daysDiff) <= 30) {
      // Today is within buffer - scroll to it without re-rendering
      setScrollToDate(new Date())  // Create new Date object to trigger useEffect
      setDisplayDate(today)
    } else {
      // Today is outside buffer or not in 3day view - recenter buffer
      setCurrentDate(new Date())
    }
  }

  const getDateHeader = () => {
    // Use displayDate for 3-day view (updates during scroll), currentDate for other views
    const dateToShow = view === '3day' ? displayDate : currentDate
    return dateToShow.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  }

  const compactButtonStyle = {
    padding: '4px 10px',
    border: 'none',
    borderRadius: '4px',
    ...typography.labelMd,
    cursor: 'pointer',
    transition: 'all 0.15s',
    minHeight: '28px'
  }

  // Get visible days for day view (77 days = 11 weeks, centered on current week)
  const getVisibleDaysForDayView = (centerDate: Date): Date[] => {
    const dates: Date[] = []
    // Start from beginning of the week, 5 weeks before
    const startOfCurrentWeek = new Date(centerDate)
    startOfCurrentWeek.setDate(centerDate.getDate() - centerDate.getDay())
    startOfCurrentWeek.setHours(0, 0, 0, 0)

    // Go back 5 weeks to start
    const startDate = new Date(startOfCurrentWeek)
    startDate.setDate(startOfCurrentWeek.getDate() - 35)

    // Generate 77 days (11 weeks)
    for (let i = 0; i < 77; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  // Get visible months for month view (3 months: prev, current, next)
  const getVisibleMonths = (centerDate: Date): Date[] => {
    const months: Date[] = []
    for (let i = -1; i <= 1; i++) {
      const d = new Date(centerDate)
      d.setDate(1)
      d.setMonth(centerDate.getMonth() + i)
      d.setHours(0, 0, 0, 0)
      months.push(d)
    }
    return months
  }

  // Scroll to center position for day view
  useEffect(() => {
    if (view === 'day' && dayScrollRef.current) {
      setTimeout(() => {
        if (dayScrollRef.current) {
          // Each day = 1/7 of viewport width, center week starts at day 35 (index 35-41)
          const dayWidth = dayScrollRef.current.clientWidth / 7
          dayScrollRef.current.scrollLeft = 35 * dayWidth
        }
      }, 50)
    }
  }, [view, currentDate])

  // Scroll to center position for month view (horizontal with snap)
  useEffect(() => {
    if (view === 'month' && monthScrollRef.current) {
      // Instantly scroll to center month (no animation on reset)
      // Use scrollTo with instant behavior to avoid smooth animation on reset
      const monthWidth = monthScrollRef.current.clientWidth
      monthScrollRef.current.scrollTo({
        left: monthWidth,
        behavior: 'instant'
      })
      isSnappingRef.current = false
    }
  }, [view, currentDate])

  // Handle scroll for day view - seamless infinite scroll
  const handleDayScroll = () => {
    if (!dayScrollRef.current) return

    const now = Date.now()
    if (now - lastScrollUpdateRef.current < 300) return

    const dayWidth = dayScrollRef.current.clientWidth / 7
    const scrollLeft = dayScrollRef.current.scrollLeft
    // Center week starts at day 35 (5 weeks from start)
    const centerScrollLeft = 35 * dayWidth
    const scrolledDays = Math.round((scrollLeft - centerScrollLeft) / dayWidth)

    // Update when scrolled 4+ weeks from center
    if (Math.abs(scrolledDays) >= 28) {
      lastScrollUpdateRef.current = now

      // Calculate offset within current position
      const offsetWithinDay = scrollLeft - (Math.round(scrollLeft / dayWidth) * dayWidth)

      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + scrolledDays)
      setCurrentDate(newDate)

      // Reset scroll position after state update, preserving offset
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (dayScrollRef.current) {
            dayScrollRef.current.scrollLeft = centerScrollLeft + offsetWithinDay
          }
        })
      })
    }
  }

  const handleDayScrollEnd = () => {
    handleDayScroll()
  }

  // Handle month scroll snap - detect when user has swiped to a different month
  const handleMonthScrollEnd = () => {
    if (!monthScrollRef.current || isSnappingRef.current) return

    const monthWidth = monthScrollRef.current.clientWidth
    const scrollLeft = monthScrollRef.current.scrollLeft
    const snappedIndex = Math.round(scrollLeft / monthWidth)

    // If snapped to a different month (not center)
    if (snappedIndex !== 1) {
      isSnappingRef.current = true
      const offset = snappedIndex - 1 // -1 for prev, +1 for next

      // Update the date (this will trigger re-render and reset scroll)
      const newDate = new Date(currentDate)
      newDate.setMonth(newDate.getMonth() + offset)
      setCurrentDate(newDate)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header row: Menu + Date + Toggle + Today */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: mobileHeaderStyles.gap,
        marginBottom: mobileHeaderStyles.marginBottom
      }}>
        <button
          onClick={() => setIsMenuOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.textPrimary,
            fontSize: mobileHeaderStyles.buttonFontSize,
            padding: mobileHeaderStyles.buttonPadding,
            cursor: 'pointer',
            minWidth: mobileHeaderStyles.buttonMinSize,
            minHeight: mobileHeaderStyles.buttonMinSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ☰
        </button>

        <h2 style={{
          ...typography.headingLg,
          fontWeight: 700,
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
          {/* Day view button - commented out
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
          */}
          <button
            onClick={() => setView('3day')}
            style={{
              ...compactButtonStyle,
              background: view === '3day' ? colors.bgHover : 'transparent',
              color: colors.textPrimary,
              fontWeight: view === '3day' ? 600 : 400
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
              fontWeight: view === 'month' ? 600 : 400
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

      {/* Day view - commented out
      {view === 'day' ? (
        <>
          <div
            ref={dayScrollRef}
            className="mobile-day-scroll"
            onScroll={handleDayScroll}
            onScrollEnd={() => handleDayScrollEnd()}
            onTouchEnd={() => setTimeout(handleDayScrollEnd, 150)}
            style={{
              marginBottom: '8px',
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              minHeight: '60px',
              display: 'flex'
            }}
          >
            {getVisibleDaysForDayView(currentDate).map((day, index) => {
              const selected = isSameDay(day, currentDate)
              const today = isToday(day)
              const dayWidth = `calc(100vw / 7)`

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setCurrentDate(day)}
                  style={{
                    width: dayWidth,
                    minWidth: dayWidth,
                    flexShrink: 0,
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
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '500',
                    color: colors.textTertiary,
                    textTransform: 'uppercase'
                  }}>
                    {dayNames[day.getDay()]}
                  </span>
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

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MobileCalendar
              view="day"
              currentDate={currentDate}
              onDateChange={(date) => setCurrentDate(date)}
            />
          </div>
        </>
      ) : */}
      {view === '3day' ? (
        /* 3-day view - MobileCalendar handles horizontal scrolling internally */
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <MobileCalendar
            view="3day"
            currentDate={currentDate}
            onDateChange={(date) => setCurrentDate(date)}
            onDisplayDateChange={(date) => setDisplayDate(date)}
            scrollToDate={scrollToDate}
          />
        </div>
      ) : (
        /* Month view - horizontal scroll with smooth snap */
        <div
          ref={monthScrollRef}
          className="mobile-month-scroll"
          onScrollEnd={() => handleMonthScrollEnd()}
          onTouchEnd={() => setTimeout(handleMonthScrollEnd, 100)}
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            display: 'flex',
            scrollSnapType: 'x mandatory'
          }}
        >
          {getVisibleMonths(currentDate).map((monthDate) => (
            <div
              key={monthDate.toISOString()}
              style={{
                width: '100%',
                minWidth: '100%',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                scrollSnapAlign: 'center',
                scrollSnapStop: 'always'
              }}
            >
              <MobileCalendar
                view="month"
                currentDate={monthDate}
                onDateChange={(date) => {
                  setCurrentDate(date)
                  setView('3day')
                }}
              />
            </div>
          ))}
        </div>
      )}

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}
