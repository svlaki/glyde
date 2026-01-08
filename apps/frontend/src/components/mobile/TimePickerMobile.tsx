import { useState, useRef, useEffect, useCallback } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'

interface TimePickerMobileProps {
  value: Date
  onChange: (date: Date) => void
  isOpen: boolean
  onClose: () => void
}

interface WheelColumnProps {
  items: (number | string)[]
  selectedIndex: number
  onSelect: (index: number) => void
  format?: (val: number | string) => string
  colors: ReturnType<typeof getColors>
}

function WheelColumn({ items, selectedIndex, onSelect, format, colors }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemHeight = 44
  const visibleItems = 5
  const containerHeight = itemHeight * visibleItems

  // Scroll to selected index on mount and when selectedIndex changes
  useEffect(() => {
    if (containerRef.current) {
      const scrollTop = selectedIndex * itemHeight
      containerRef.current.scrollTop = scrollTop
    }
  }, [selectedIndex])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const scrollTop = containerRef.current.scrollTop
    const newIndex = Math.round(scrollTop / itemHeight)
    const clampedIndex = Math.max(0, Math.min(items.length - 1, newIndex))
    if (clampedIndex !== selectedIndex) {
      onSelect(clampedIndex)
    }
  }, [items.length, selectedIndex, onSelect])

  const handleItemClick = (index: number) => {
    onSelect(index)
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * itemHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {/* Selection highlight */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: `${itemHeight}px`,
        transform: 'translateY(-50%)',
        background: colors.bgHover,
        borderRadius: '8px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: `${containerHeight}px`,
          overflowY: 'scroll',
          position: 'relative',
          zIndex: 1,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Top padding to center first item */}
        <div style={{ height: `${itemHeight * 2}px` }} />

        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex
          return (
            <div
              key={idx}
              onClick={() => handleItemClick(idx)}
              style={{
                height: `${itemHeight}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: isSelected ? '600' : '400',
                color: isSelected ? colors.textPrimary : colors.textTertiary,
                cursor: 'pointer',
                transition: 'color 0.15s, font-weight 0.15s',
                userSelect: 'none'
              }}
            >
              {format ? format(item) : String(item)}
            </div>
          )
        })}

        {/* Bottom padding to center last item */}
        <div style={{ height: `${itemHeight * 2}px` }} />
      </div>
    </div>
  )
}

export function TimePickerMobile({ value, onChange, isOpen, onClose }: TimePickerMobileProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5) // 0, 5, 10, ... 55
  const ampmOptions = ['AM', 'PM']

  const getInitialState = useCallback(() => {
    const h = value.getHours()
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    const hourIndex = hours.indexOf(hour12)
    const minuteIndex = Math.round(value.getMinutes() / 5) % 12
    const ampmIndex = value.getHours() >= 12 ? 1 : 0
    return { hourIndex, minuteIndex, ampmIndex }
  }, [value])

  const [hourIndex, setHourIndex] = useState(() => getInitialState().hourIndex)
  const [minuteIndex, setMinuteIndex] = useState(() => getInitialState().minuteIndex)
  const [ampmIndex, setAmpmIndex] = useState(() => getInitialState().ampmIndex)

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      const initial = getInitialState()
      setHourIndex(initial.hourIndex)
      setMinuteIndex(initial.minuteIndex)
      setAmpmIndex(initial.ampmIndex)
    }
  }, [isOpen, getInitialState])

  if (!isOpen) return null

  const handleConfirm = () => {
    const newDate = new Date(value)
    const hour12 = hours[hourIndex]
    const minute = minutes[minuteIndex]
    const isPM = ampmIndex === 1

    let hour24 = hour12
    if (isPM && hour12 !== 12) {
      hour24 = hour12 + 12
    } else if (!isPM && hour12 === 12) {
      hour24 = 0
    }

    newDate.setHours(hour24, minute, 0, 0)
    onChange(newDate)
    onClose()
  }

  const selectedHour = hours[hourIndex]
  const selectedMinute = minutes[minuteIndex]
  const selectedAmpm = ampmOptions[ampmIndex]

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
          width: '100%',
          maxWidth: '320px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header with current time */}
        <div style={{
          padding: '20px 16px',
          borderBottom: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '36px',
            fontWeight: '600',
            color: colors.textPrimary,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {selectedHour}:{String(selectedMinute).padStart(2, '0')} {selectedAmpm}
          </div>
        </div>

        {/* Wheel Container */}
        <div style={{
          display: 'flex',
          padding: '8px 16px',
          gap: '4px'
        }}>
          {/* Hour wheel */}
          <WheelColumn
            items={hours}
            selectedIndex={hourIndex}
            onSelect={setHourIndex}
            colors={colors}
          />

          {/* Separator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: '600',
            color: colors.textPrimary,
            width: '16px'
          }}>
            :
          </div>

          {/* Minute wheel */}
          <WheelColumn
            items={minutes}
            selectedIndex={minuteIndex}
            onSelect={setMinuteIndex}
            format={(val) => String(val).padStart(2, '0')}
            colors={colors}
          />

          {/* AM/PM wheel */}
          <WheelColumn
            items={ampmOptions}
            selectedIndex={ampmIndex}
            onSelect={setAmpmIndex}
            colors={colors}
          />
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '16px',
          borderTop: `1px solid ${colors.border}`
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              background: colors.bgPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              color: colors.textPrimary,
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '14px',
              background: '#000',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Hide scrollbar CSS */}
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
