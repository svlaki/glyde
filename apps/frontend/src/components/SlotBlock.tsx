import { useState, useRef, useEffect } from 'react'
import { hexToRgba } from '../styles/colors'
import { fontFamily, fontWeight } from '../styles/typography'
import type { SlotWithSuggestion } from '../lib/suggestionService'

interface SlotBlockProps {
  slot: SlotWithSuggestion
  top: number
  height: number
  layout: { width: string; left: string; right: string; zIndex: number }
  defaultColor: string
  onSwapPrev: (slotId: string) => void
  onSwapNext: (slotId: string) => void
  onConfirm: (slotId: string) => void
  onDismiss: (slotId: string) => void
  onClick: (slot: SlotWithSuggestion) => void
  onPointerDown: (e: React.PointerEvent, slotId: string) => void
  isDragSource: boolean
  isPointerDragging: boolean
  wasDragRef: React.MutableRefObject<boolean>
  onResizeStart: (e: React.MouseEvent, slot: SlotWithSuggestion) => void
}

const CHECKERBOARD_SIZE = 8

function buildCheckerboardBackground(color: string): string {
  const c1 = hexToRgba(color, 0.08)
  const c2 = hexToRgba(color, 0.04)
  return `repeating-conic-gradient(${c1} 0% 25%, ${c2} 0% 50%) 0 0 / ${CHECKERBOARD_SIZE}px ${CHECKERBOARD_SIZE}px`
}

export function SlotBlock({
  slot,
  top,
  height,
  layout,
  defaultColor,
  onSwapPrev,
  onSwapNext,
  onConfirm,
  onDismiss,
  onClick,
  onPointerDown,
  isDragSource,
  isPointerDragging,
  wasDragRef,
  onResizeStart,
}: SlotBlockProps) {
  const [isHovered, setIsHovered] = useState(false)
  const slotColor = slot.aspect_color || defaultColor

  // Swipe animation
  const [slideClass, setSlideClass] = useState<'none' | 'out-left' | 'out-right' | 'enter-from-right' | 'enter-from-left'>('none')
  const prevTitleRef = useRef(slot.suggestion_title)
  const lastDirectionRef = useRef<'left' | 'right'>('right')

  // When suggestion changes, slide in from the opposite side it left
  useEffect(() => {
    if (slot.suggestion_title !== prevTitleRef.current) {
      prevTitleRef.current = slot.suggestion_title
      // If swiped right (next), content left -> new enters from right
      // If swiped left (prev), content right -> new enters from left
      const enterFrom = lastDirectionRef.current === 'right' ? 'enter-from-right' : 'enter-from-left'
      setSlideClass(enterFrom as any)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideClass('none')
        })
      })
    }
    return undefined
  }, [slot.suggestion_title])

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (slideClass !== 'none') return
    lastDirectionRef.current = 'left'
    setSlideClass('out-right')
    setTimeout(() => onSwapPrev(slot.id), 80)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (slideClass !== 'none') return
    lastDirectionRef.current = 'right'
    setSlideClass('out-left')
    setTimeout(() => onSwapNext(slot.id), 80)
  }

  const startTime = new Date(slot.start_time).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const slideTransform = (): React.CSSProperties => {
    const speed = '100ms'
    switch (slideClass) {
      // Exits
      case 'out-left':
        return { transform: 'translateX(-110%)', opacity: 0, transition: `transform ${speed} ease-in, opacity ${speed} ease-in` }
      case 'out-right':
        return { transform: 'translateX(110%)', opacity: 0, transition: `transform ${speed} ease-in, opacity ${speed} ease-in` }
      // Enter start positions (no transition yet — placed offscreen instantly)
      case 'enter-from-right':
        return { transform: 'translateX(110%)', opacity: 0, transition: 'none' }
      case 'enter-from-left':
        return { transform: 'translateX(-110%)', opacity: 0, transition: 'none' }
      // Settled (animate from offscreen to center)
      default:
        return { transform: 'translateX(0)', opacity: 1, transition: `transform ${speed} ease-out, opacity ${speed} ease-out` }
    }
  }

  const btnSize = height >= 50 ? '18px' : '16px'
  const btnFontSize = height >= 50 ? '10px' : '9px'

  const actionBtn = (bgColor: string, fgColor: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: btnSize,
    height: btnSize,
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: btnFontSize,
    fontFamily: fontFamily.sans,
    fontWeight: fontWeight.semibold,
    background: hexToRgba(bgColor, 0.15),
    color: fgColor,
    padding: 0,
    transition: 'background 0.1s, transform 0.1s',
    flexShrink: 0,
  })

  return (
    <div
      onPointerDown={(e) => onPointerDown(e, slot.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        if (isPointerDragging || wasDragRef.current) {
          wasDragRef.current = false
          return
        }
        onClick(slot)
      }}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: layout.left === '2px' ? '4px' : layout.left,
        right: layout.right === '2px' ? '4px' : layout.right,
        width: layout.width,
        height: `${height}px`,
        background: buildCheckerboardBackground(slotColor),
        border: `2px dashed ${hexToRgba(slotColor, 0.5)}`,
        borderRadius: '4px',
        overflow: 'hidden',
        zIndex: layout.zIndex,
        cursor: isDragSource ? 'grabbing' : 'grab',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isHovered ? `0 0 0 1px ${hexToRgba(slotColor, 0.3)}` : 'none',
        opacity: isDragSource ? 0.3 : 1,
        transform: isDragSource ? 'scale(0.97)' : 'none',
        touchAction: 'none',
      }}
      title={`Suggestion: ${slot.suggestion_title}\n${startTime}\n${slot.reasoning || ''}`}
    >
      {/* Clickable card content with directional slide */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '2px 6px',
        }}
      >
        <div style={{ ...slideTransform(), display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{
            fontSize: '6px',
            fontFamily: fontFamily.sans,
            fontWeight: fontWeight.semibold,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            padding: '0px 3px',
            borderRadius: '3px',
            background: hexToRgba(slotColor, 0.2),
            color: slotColor,
            alignSelf: 'flex-start',
            lineHeight: '1.4',
          }}>
            Suggested
          </span>
          <span style={{
            fontSize: '10px',
            fontFamily: fontFamily.sans,
            fontWeight: fontWeight.medium,
            color: slotColor,
            lineHeight: '1.2',
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: height >= 60 ? 3 : height >= 40 ? 2 : 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {slot.suggestion_title}
          </span>
          {height >= 35 && (
            <span style={{
              fontSize: '9px',
              color: hexToRgba(slotColor, 0.6),
              fontFamily: fontFamily.sans,
            }}>
              {startTime}
            </span>
          )}
        </div>
      </div>

      {/* Bottom bar: left arrow, dismiss, confirm, right arrow */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 4px',
          borderTop: `1px solid ${hexToRgba(slotColor, 0.1)}`,
          flexShrink: 0,
          gap: '3px',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handlePrev}
          style={actionBtn(slotColor, slotColor)}
          onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(slotColor, 0.25) }}
          onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(slotColor, 0.15) }}
          title="Previous suggestion"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          onClick={() => onDismiss(slot.id)}
          style={actionBtn('#ef4444', '#ef4444')}
          onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba('#ef4444', 0.3) }}
          onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba('#ef4444', 0.15) }}
          title="Dismiss"
        >
          &#10005;
        </button>

        <button
          onClick={() => onConfirm(slot.id)}
          style={actionBtn('#22c55e', '#22c55e')}
          onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba('#22c55e', 0.3) }}
          onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba('#22c55e', 0.15) }}
          title="Accept"
        >
          &#10003;
        </button>

        <button
          onClick={handleNext}
          style={actionBtn(slotColor, slotColor)}
          onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(slotColor, 0.25) }}
          onMouseLeave={(e) => { e.currentTarget.style.background = hexToRgba(slotColor, 0.15) }}
          title="Next suggestion"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onResizeStart(e, slot)
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '6px',
          cursor: 'ns-resize',
          background: isHovered ? hexToRgba(slotColor, 0.15) : 'transparent',
          borderRadius: '0 0 4px 4px',
        }}
      />
    </div>
  )
}
