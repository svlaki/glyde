import { useState, useRef, useCallback, useEffect } from 'react'
import { AspectCard } from './AspectCard'
import type { Aspect } from '../lib/aspectService'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'

interface DraggableAspectListProps {
  aspects: Aspect[]
  selectedAspect?: Aspect | null
  onSelect: (aspect: Aspect) => void
  onEdit?: (aspect: Aspect) => void
  onDelete?: (aspect: Aspect) => void
  onReorder: (reordered: Aspect[]) => void
}

const LONG_PRESS_MS = 400
const MOVE_THRESHOLD = 10

export function DraggableAspectList({
  aspects,
  selectedAspect,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
}: DraggableAspectListProps) {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const { isMobile } = usePlatform()

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)
  const longPressActivated = useRef(false)
  const dragIndexRef = useRef<number | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const getDropTarget = useCallback((clientY: number): number => {
    const rects = itemRefs.current
      .map((el, i) => el ? { index: i, rect: el.getBoundingClientRect() } : null)
      .filter(Boolean) as { index: number; rect: DOMRect }[]

    for (const { index, rect } of rects) {
      const midY = rect.top + rect.height / 2
      if (clientY < midY) return index
    }
    return aspects.length
  }, [aspects.length])

  const finishDrag = useCallback((clientY: number) => {
    const from = dragIndexRef.current
    if (from === null) return

    const to = getDropTarget(clientY)
    const actualTo = to > from ? to - 1 : to

    if (actualTo !== from) {
      const reordered = [...aspects]
      const removed = reordered.splice(from, 1)
      if (removed[0]) {
        reordered.splice(actualTo, 0, removed[0])
        onReorder(reordered)
      }
    }

    setDragIndex(null)
    setDropIndex(null)
    setIsDragging(false)
    dragIndexRef.current = null
    longPressActivated.current = false
  }, [aspects, getDropTarget, onReorder])

  // Mouse handlers (desktop) - drag starts only after moving past threshold
  const pendingMouseDrag = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    if (isMobile) return

    startPos.current = { x: e.clientX, y: e.clientY }
    hasMovedRef.current = false
    dragIndexRef.current = index
    pendingMouseDrag.current = true

    const el = itemRefs.current[index]
    if (el) {
      const rect = el.getBoundingClientRect()
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      setGhostPos({ x: e.clientX, y: e.clientY })
    }
  }, [isMobile])

  useEffect(() => {
    if (isMobile) return

    const handleMouseMove = (e: MouseEvent) => {
      if (pendingMouseDrag.current && !isDragging) {
        const dx = e.clientX - startPos.current.x
        const dy = e.clientY - startPos.current.y
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
          hasMovedRef.current = true
          pendingMouseDrag.current = false
          setDragIndex(dragIndexRef.current)
          setDropIndex(dragIndexRef.current)
          setIsDragging(true)
          setGhostPos({ x: e.clientX, y: e.clientY })
        }
        return
      }

      if (!isDragging) return
      setGhostPos({ x: e.clientX, y: e.clientY })
      setDropIndex(getDropTarget(e.clientY))
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (pendingMouseDrag.current && !isDragging) {
        // Didn't move enough - treat as click
        pendingMouseDrag.current = false
        const idx = dragIndexRef.current
        if (idx !== null && aspects[idx]) {
          onSelect(aspects[idx])
        }
        dragIndexRef.current = null
        return
      }

      if (isDragging) {
        finishDrag(e.clientY)
      }
      pendingMouseDrag.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isMobile, isDragging, getDropTarget, finishDrag, aspects, onSelect])

  // Touch handlers (mobile - long press)
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    if (!isMobile) return

    const touch = e.touches[0]
    if (!touch) return
    startPos.current = { x: touch.clientX, y: touch.clientY }
    hasMovedRef.current = false
    longPressActivated.current = false

    const startX = touch.clientX
    const startY = touch.clientY

    longPressTimer.current = setTimeout(() => {
      longPressActivated.current = true
      dragIndexRef.current = index

      const el = itemRefs.current[index]
      if (el) {
        const rect = el.getBoundingClientRect()
        setDragOffset({ x: startX - rect.left, y: startY - rect.top })
        setGhostPos({ x: startX, y: startY })
      }

      setDragIndex(index)
      setDropIndex(index)
      setIsDragging(true)

      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(30)
      }
    }, LONG_PRESS_MS)
  }, [isMobile])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return

    const touch = e.touches[0]
    if (!touch) return
    const dx = touch.clientX - startPos.current.x
    const dy = touch.clientY - startPos.current.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (!longPressActivated.current) {
      if (distance > MOVE_THRESHOLD) {
        clearLongPress()
        hasMovedRef.current = true
      }
      return
    }

    // Prevent scroll while dragging
    e.preventDefault()
    setGhostPos({ x: touch.clientX, y: touch.clientY })
    setDropIndex(getDropTarget(touch.clientY))
  }, [isMobile, clearLongPress, getDropTarget])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return
    clearLongPress()

    if (longPressActivated.current && isDragging) {
      const touch = e.changedTouches[0]
      if (touch) {
        finishDrag(touch.clientY)
      }
      return
    }

    // If no long press and didn't move much, it's a tap
    if (!hasMovedRef.current && !longPressActivated.current) {
      const idx = dragIndexRef.current ?? null
      if (idx !== null && aspects[idx]) {
        onSelect(aspects[idx])
      }
    }

    dragIndexRef.current = null
    longPressActivated.current = false
  }, [isMobile, isDragging, clearLongPress, finishDrag, aspects, onSelect])

  // Clean up on unmount
  useEffect(() => {
    return () => clearLongPress()
  }, [clearLongPress])

  // Get ghost element dimensions
  const draggedEl = dragIndex !== null ? itemRefs.current[dragIndex] : null
  const ghostWidth = draggedEl?.offsetWidth ?? 0

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
      }}
    >
      {aspects.map((aspect, index) => {
        const isBeingDragged = dragIndex === index && isDragging
        const showDropAbove = dropIndex === index && dragIndex !== null && dragIndex !== index

        return (
          <div key={aspect.id}>
            {/* Drop indicator line */}
            {showDropAbove && (
              <div style={{
                height: '3px',
                background: aspect.color || colors.accent,
                borderRadius: '2px',
                marginBottom: '9px',
                transition: 'opacity 0.15s',
              }} />
            )}
            <div
              ref={(el) => { itemRefs.current[index] = el }}
              onMouseDown={(e) => handleMouseDown(e, index)}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                opacity: isBeingDragged ? 0.3 : 1,
                transition: isBeingDragged ? 'none' : 'opacity 0.15s',
                touchAction: 'auto',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              <AspectCard
                aspect={aspect}
                isSelected={selectedAspect?.id === aspect.id}
                onClick={() => {}}
                {...(onEdit && aspect.member_role !== 'viewer'
                  ? { onEdit: () => onEdit(aspect) }
                  : {}
                )}
                {...(onDelete && aspect.member_role === 'owner'
                  ? { onDelete: () => onDelete(aspect) }
                  : {}
                )}
              />
            </div>
          </div>
        )
      })}

      {/* Drop indicator at bottom */}
      {dropIndex === aspects.length && dragIndex !== null && isDragging && (
        <div style={{
          height: '3px',
          background: colors.accent,
          borderRadius: '2px',
          transition: 'opacity 0.15s',
        }} />
      )}

      {/* Ghost / drag preview */}
      {isDragging && dragIndex !== null && aspects[dragIndex] && (
        <div
          style={{
            position: 'fixed',
            left: ghostPos.x - dragOffset.x,
            top: ghostPos.y - dragOffset.y,
            width: ghostWidth,
            zIndex: 9999,
            pointerEvents: 'none',
            opacity: 0.85,
            transform: 'scale(1.03)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <AspectCard
            aspect={aspects[dragIndex]}
            isSelected={false}
            onClick={() => {}}
          />
        </div>
      )}
    </div>
  )
}
