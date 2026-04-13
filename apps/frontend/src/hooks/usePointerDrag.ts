import { useState, useRef, useCallback, useEffect } from 'react'

export interface DropTarget {
  date: Date
  hour: number
  quarter: number
}

export type DragSourceType = 'event' | 'slot'

interface UsePointerDragOptions {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  ghostRef: React.RefObject<HTMLDivElement | null>
  previewRef: React.RefObject<HTMLDivElement | null>
  onDrop: (sourceId: string, target: DropTarget, sourceType: DragSourceType) => void
  edgeZone?: number
  scrollSpeed?: number
  deadZone?: number
}

export interface UsePointerDragReturn {
  isDragging: boolean
  dragSourceId: string | null
  dragSourceType: DragSourceType | null
  /** For tasks — pointer drag doesn't handle HTML5 native, so Calendar still needs these */
  dropPreview: DropTarget | null
  startDrag: (e: React.PointerEvent, sourceId: string, sourceType?: DragSourceType) => void
  /** True if the last pointer interaction resulted in a drag (use to suppress click) */
  wasDragRef: React.RefObject<boolean>
}

/**
 * High-performance pointer-based drag system.
 *
 * Key design decisions (from research):
 * - setPointerCapture keeps events firing when cursor leaves source element
 * - Ghost and preview indicator updated via direct DOM manipulation (refs), NOT React state
 * - All pointermove processing batched into requestAnimationFrame (one paint per frame)
 * - Snap uses Math.round for nearest-quarter precision instead of Math.floor
 * - Position uses accumulated movementX/Y deltas — immune to scroll-offset drift
 */
export function usePointerDrag({
  scrollContainerRef,
  ghostRef,
  previewRef,
  onDrop,
  edgeZone = 50,
  scrollSpeed = 12,
  deadZone = 5,
}: UsePointerDragOptions): UsePointerDragReturn {
  const [isDragging, setIsDragging] = useState(false)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<DragSourceType | null>(null)
  // Keep HTML5-compatible preview for task drops from sidebar (set externally, not by this hook)
  const dropPreview = null as DropTarget | null

  // --- Refs for zero-render-cost drag state ---
  const activeRef = useRef(false)
  const sourceIdRef = useRef<string | null>(null)
  const sourceTypeRef = useRef<DragSourceType>('event')
  const startXY = useRef({ x: 0, y: 0 })
  const wasDragged = useRef(false)

  // Ghost position: accumulated from movementX/Y (scroll-immune)
  const ghostX = useRef(0)
  const ghostY = useRef(0)
  // Initial offset of pointer within the source element
  const pointerOffsetX = useRef(0)
  const pointerOffsetY = useRef(0)
  // Source element dimensions for ghost sizing
  const sourceWidth = useRef(0)
  const sourceHeight = useRef(0)

  // rAF handle for auto-scroll
  const autoScrollFrame = useRef<number | null>(null)
  // rAF handle for pointermove batching
  const moveFrame = useRef<number | null>(null)
  // Latest pointer coordinates (updated every pointermove, consumed once per rAF)
  const latestClientX = useRef(0)
  const latestClientY = useRef(0)
  // Captured element for releasePointerCapture
  const capturedEl = useRef<HTMLElement | null>(null)
  const capturedPointerId = useRef<number | null>(null)

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrame.current !== null) {
      cancelAnimationFrame(autoScrollFrame.current)
      autoScrollFrame.current = null
    }
  }, [])

  // --- Quarter snap: nearest boundary, clamped 0-3 ---
  const snapQuarter = useCallback((offsetY: number, cellHeight: number): number => {
    const quarterHeight = cellHeight / 4
    const raw = Math.round(offsetY / quarterHeight - 0.5)
    return Math.max(0, Math.min(3, raw))
  }, [])

  // --- Find drop target under pointer ---
  const findDropTarget = useCallback((clientX: number, clientY: number): { cell: HTMLElement; target: DropTarget } | null => {
    const els = document.elementsFromPoint(clientX, clientY)
    for (const el of els) {
      const cell = (el as HTMLElement).closest('[data-drop-target]') as HTMLElement | null
      if (cell) {
        const dateStr = cell.dataset.dropDate
        const hourStr = cell.dataset.dropHour
        if (dateStr && hourStr) {
          const cellRect = cell.getBoundingClientRect()
          const oy = clientY - cellRect.top
          const quarter = snapQuarter(oy, cellRect.height)
          return {
            cell,
            target: {
              date: new Date(dateStr),
              hour: parseInt(hourStr, 10),
              quarter,
            },
          }
        }
        break
      }
    }
    return null
  }, [snapQuarter])

  // --- Update ghost position (direct DOM, no React) ---
  const updateGhost = useCallback((clientX: number, clientY: number) => {
    const ghost = ghostRef.current
    if (!ghost) return
    const tx = clientX - pointerOffsetX.current
    const ty = clientY - pointerOffsetY.current
    ghost.style.transform = `translate(${tx}px, ${ty}px) scale(1.03)`
    ghost.style.width = `${sourceWidth.current}px`
    ghost.style.height = `${Math.min(sourceHeight.current, 80)}px`
  }, [ghostRef])

  // --- Update preview indicator (direct DOM, no React) ---
  const updatePreview = useCallback((result: { cell: HTMLElement; target: DropTarget } | null) => {
    const preview = previewRef.current
    if (!preview) return
    if (!result) {
      preview.style.display = 'none'
      return
    }
    const cellRect = result.cell.getBoundingClientRect()
    const container = scrollContainerRef.current
    if (!container) return

    // Position preview line inside the cell, accounting for scroll container offset
    const containerRect = container.getBoundingClientRect()
    const quarterY = (result.target.quarter / 4) * cellRect.height

    preview.style.display = 'block'
    preview.style.top = `${cellRect.top - containerRect.top + container.scrollTop + quarterY}px`
    preview.style.left = `${cellRect.left - containerRect.left + container.scrollLeft}px`
    preview.style.width = `${cellRect.width}px`
  }, [previewRef, scrollContainerRef])

  // --- Auto-scroll near edges ---
  const runAutoScroll = useCallback((clientX: number, clientY: number) => {
    const container = scrollContainerRef.current
    if (!container) return

    stopAutoScroll()

    const cr = container.getBoundingClientRect()
    const x = clientX - cr.left
    const y = clientY - cr.top

    let dx = 0
    let dy = 0

    if (x < edgeZone) {
      dx = -scrollSpeed * (1 - x / edgeZone)
    } else if (x > cr.width - edgeZone) {
      dx = scrollSpeed * (1 - (cr.width - x) / edgeZone)
    }

    if (y < edgeZone) {
      dy = -scrollSpeed * (1 - y / edgeZone)
    } else if (y > cr.height - edgeZone) {
      dy = scrollSpeed * (1 - (cr.height - y) / edgeZone)
    }

    if (dx !== 0 || dy !== 0) {
      const tick = () => {
        container.scrollLeft += dx
        container.scrollTop += dy
        // Re-update ghost and preview during scroll using latest pointer coords
        updateGhost(latestClientX.current, latestClientY.current)
        const result = findDropTarget(latestClientX.current, latestClientY.current)
        updatePreview(result)
        autoScrollFrame.current = requestAnimationFrame(tick)
      }
      autoScrollFrame.current = requestAnimationFrame(tick)
    }
  }, [scrollContainerRef, edgeZone, scrollSpeed, stopAutoScroll, updateGhost, findDropTarget, updatePreview])

  // --- Core pointermove handler (batched to rAF) ---
  const processMove = useCallback(() => {
    moveFrame.current = null
    if (!activeRef.current) return

    const cx = latestClientX.current
    const cy = latestClientY.current

    updateGhost(cx, cy)

    const result = findDropTarget(cx, cy)
    updatePreview(result)

    runAutoScroll(cx, cy)
  }, [updateGhost, findDropTarget, updatePreview, runAutoScroll])

  // --- Start drag ---
  const startDrag = useCallback((e: React.PointerEvent, id: string, type: DragSourceType = 'event') => {
    if (e.button !== 0) return

    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()

    sourceIdRef.current = id
    sourceTypeRef.current = type
    activeRef.current = false
    wasDragged.current = false

    pointerOffsetX.current = e.clientX - rect.left
    pointerOffsetY.current = e.clientY - rect.top
    sourceWidth.current = rect.width
    sourceHeight.current = rect.height
    ghostX.current = e.clientX
    ghostY.current = e.clientY
    startXY.current = { x: e.clientX, y: e.clientY }
    latestClientX.current = e.clientX
    latestClientY.current = e.clientY

    // Capture pointer so events keep firing even if cursor leaves the element
    el.setPointerCapture(e.pointerId)
    capturedEl.current = el
    capturedPointerId.current = e.pointerId

    setSourceId(id)
    setSourceType(type)
  }, [])

  // --- Attach/detach pointer handlers when sourceId changes ---
  useEffect(() => {
    if (!sourceId) return
    const el = capturedEl.current
    if (!el) return

    const onMove = (e: PointerEvent) => {
      // Dead zone check before activating drag
      if (!activeRef.current) {
        const dx = e.clientX - startXY.current.x
        const dy = e.clientY - startXY.current.y
        if (Math.sqrt(dx * dx + dy * dy) < deadZone) return
        activeRef.current = true
        wasDragged.current = true
        setIsDragging(true)

        // Show ghost
        const ghost = ghostRef.current
        if (ghost) {
          ghost.style.display = 'block'
          ghost.style.position = 'fixed'
          ghost.style.left = '0px'
          ghost.style.top = '0px'
          ghost.style.zIndex = '10000'
          ghost.style.pointerEvents = 'none'
          ghost.style.willChange = 'transform'
          ghost.style.opacity = '0.92'
          ghost.style.borderRadius = '6px'
          ghost.style.boxShadow = '0 12px 28px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1)'
          ghost.style.overflow = 'hidden'
        }

        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
      }

      // Store latest coordinates; schedule rAF if not already pending
      latestClientX.current = e.clientX
      latestClientY.current = e.clientY

      if (moveFrame.current === null) {
        moveFrame.current = requestAnimationFrame(processMove)
      }
    }

    const onUp = (e: PointerEvent) => {
      stopAutoScroll()
      if (moveFrame.current !== null) {
        cancelAnimationFrame(moveFrame.current)
        moveFrame.current = null
      }

      document.body.style.userSelect = ''
      document.body.style.cursor = ''

      // Hide ghost and preview
      const ghost = ghostRef.current
      if (ghost) ghost.style.display = 'none'
      const preview = previewRef.current
      if (preview) preview.style.display = 'none'

      if (activeRef.current && sourceIdRef.current) {
        const result = findDropTarget(e.clientX, e.clientY)
        if (result) {
          onDrop(sourceIdRef.current, result.target, sourceTypeRef.current)
        }
      }

      // Release pointer capture
      if (capturedEl.current && capturedPointerId.current !== null) {
        try { capturedEl.current.releasePointerCapture(capturedPointerId.current) } catch { /* already released */ }
      }

      activeRef.current = false
      sourceIdRef.current = null
      capturedEl.current = null
      capturedPointerId.current = null
      setIsDragging(false)
      setSourceId(null)
      setSourceType(null)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    // pointercancel handles interrupted drags (e.g. alert popup)
    el.addEventListener('pointercancel', onUp)

    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      stopAutoScroll()
      if (moveFrame.current !== null) {
        cancelAnimationFrame(moveFrame.current)
        moveFrame.current = null
      }
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [sourceId, deadZone, processMove, stopAutoScroll, findDropTarget, onDrop, ghostRef, previewRef])

  return {
    isDragging,
    dragSourceId: sourceId,
    dragSourceType: sourceType,
    dropPreview,
    startDrag,
    wasDragRef: wasDragged,
  }
}
