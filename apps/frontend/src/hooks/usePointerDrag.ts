import { useState, useRef, useCallback, useEffect } from 'react'

export interface DropTarget {
  date: Date
  hour: number
  quarter: number
}

interface DragState {
  sourceId: string | null
  pointerX: number
  pointerY: number
  offsetX: number
  offsetY: number
  sourceRect: DOMRect | null
  active: boolean
}

interface UsePointerDragOptions {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  onDrop: (sourceId: string, target: DropTarget) => void
  edgeZone?: number
  scrollSpeed?: number
  deadZone?: number
}

export interface UsePointerDragReturn {
  isDragging: boolean
  dragSourceId: string | null
  dropPreview: DropTarget | null
  ghostStyle: React.CSSProperties | null
  startDrag: (e: React.PointerEvent, sourceId: string) => void
  /** True if the last pointer interaction resulted in a drag (use to suppress click) */
  wasDragRef: React.RefObject<boolean>
}

const INITIAL: DragState = {
  sourceId: null,
  pointerX: 0,
  pointerY: 0,
  offsetX: 0,
  offsetY: 0,
  sourceRect: null,
  active: false,
}

export function usePointerDrag({
  scrollContainerRef,
  onDrop,
  edgeZone = 50,
  scrollSpeed = 10,
  deadZone = 5,
}: UsePointerDragOptions): UsePointerDragReturn {
  const [active, setActive] = useState(false)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [dropPreview, setDropPreview] = useState<DropTarget | null>(null)
  const [ghostStyle, setGhostStyle] = useState<React.CSSProperties | null>(null)

  const drag = useRef<DragState>(INITIAL)
  const autoFrame = useRef<number | null>(null)
  const startXY = useRef({ x: 0, y: 0 })
  const wasDragged = useRef(false)

  const stopAutoScroll = useCallback(() => {
    if (autoFrame.current !== null) {
      cancelAnimationFrame(autoFrame.current)
      autoFrame.current = null
    }
  }, [])

  const startDrag = useCallback((e: React.PointerEvent, id: string) => {
    // Only primary button
    if (e.button !== 0) return

    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()

    drag.current = {
      sourceId: id,
      pointerX: e.clientX,
      pointerY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      sourceRect: rect,
      active: false,
    }
    startXY.current = { x: e.clientX, y: e.clientY }
    wasDragged.current = false
    setSourceId(id)
  }, [])

  useEffect(() => {
    if (!sourceId) return

    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.sourceId) return

      // Dead zone check
      if (!d.active) {
        const dx = e.clientX - startXY.current.x
        const dy = e.clientY - startXY.current.y
        if (Math.sqrt(dx * dx + dy * dy) < deadZone) return
        d.active = true
        wasDragged.current = true
        setActive(true)
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
      }

      d.pointerX = e.clientX
      d.pointerY = e.clientY

      // Update ghost position using transform (GPU accelerated)
      const rect = d.sourceRect!
      setGhostStyle({
        position: 'fixed',
        left: 0,
        top: 0,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: `translate(${e.clientX - d.offsetX}px, ${e.clientY - d.offsetY}px) scale(1.04)`,
        willChange: 'transform',
        zIndex: 10000,
        pointerEvents: 'none',
        boxShadow: '0 12px 28px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1)',
        borderRadius: '6px',
        opacity: 0.92,
        cursor: 'grabbing',
        transition: 'box-shadow 0.15s ease, transform 0.02s linear',
      })

      // Auto-scroll near edges
      const container = scrollContainerRef.current
      if (container) {
        const cr = container.getBoundingClientRect()
        const x = e.clientX - cr.left
        const y = e.clientY - cr.top

        stopAutoScroll()

        let dx = 0
        let dy = 0

        // Horizontal: accelerate closer to edge
        if (x < edgeZone) {
          dx = -scrollSpeed * (1 - x / edgeZone)
        } else if (x > cr.width - edgeZone) {
          dx = scrollSpeed * (1 - (cr.width - x) / edgeZone)
        }

        // Vertical
        if (y < edgeZone) {
          dy = -scrollSpeed * (1 - y / edgeZone)
        } else if (y > cr.height - edgeZone) {
          dy = scrollSpeed * (1 - (cr.height - y) / edgeZone)
        }

        if (dx !== 0 || dy !== 0) {
          const tick = () => {
            container.scrollLeft += dx
            container.scrollTop += dy
            autoFrame.current = requestAnimationFrame(tick)
          }
          autoFrame.current = requestAnimationFrame(tick)
        }
      }

      // Find drop target via elementsFromPoint
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      let found = false
      for (const el of els) {
        const cell = (el as HTMLElement).closest('[data-drop-target]') as HTMLElement | null
        if (cell) {
          const dateStr = cell.dataset.dropDate
          const hourStr = cell.dataset.dropHour
          if (dateStr && hourStr) {
            const cellRect = cell.getBoundingClientRect()
            const oy = e.clientY - cellRect.top
            const quarter = Math.max(0, Math.min(3, Math.floor((oy / cellRect.height) * 4)))
            setDropPreview({
              date: new Date(dateStr),
              hour: parseInt(hourStr, 10),
              quarter,
            })
            found = true
          }
          break
        }
      }
      if (!found) setDropPreview(null)
    }

    const onUp = (e: PointerEvent) => {
      const d = drag.current
      stopAutoScroll()
      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      if (d.active && d.sourceId) {
        // Find drop target
        const els = document.elementsFromPoint(e.clientX, e.clientY)
        for (const el of els) {
          const cell = (el as HTMLElement).closest('[data-drop-target]') as HTMLElement | null
          if (cell) {
            const dateStr = cell.dataset.dropDate
            const hourStr = cell.dataset.dropHour
            if (dateStr && hourStr) {
              const cellRect = cell.getBoundingClientRect()
              const oy = e.clientY - cellRect.top
              const quarter = Math.max(0, Math.min(3, Math.floor((oy / cellRect.height) * 4)))
              onDrop(d.sourceId, {
                date: new Date(dateStr),
                hour: parseInt(hourStr, 10),
                quarter,
              })
              break
            }
          }
        }
      }

      drag.current = INITIAL
      setActive(false)
      setSourceId(null)
      setGhostStyle(null)
      setDropPreview(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      stopAutoScroll()
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [sourceId, scrollContainerRef, onDrop, edgeZone, scrollSpeed, deadZone, stopAutoScroll])

  return {
    isDragging: active,
    dragSourceId: sourceId,
    dropPreview,
    ghostStyle,
    startDrag,
    wasDragRef: wasDragged,
  }
}
