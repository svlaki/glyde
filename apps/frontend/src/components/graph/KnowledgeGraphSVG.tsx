import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useTheme } from '../../lib/themeContext'
import { getColors, hexToRgba } from '../../styles/colors'
import { buildGraphNodes, buildGraphLinks } from './graphLayout'
import type { GraphNode, GraphLink } from './graphTypes'
import type { KnowledgeGraphData } from '../../lib/knowledgeGraphService'

// 5-pointed star path centered at (0,0)
function starPath(r: number): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 2) + (i * Math.PI / 5)
    const radius = i % 2 === 0 ? r : r * 0.45
    points.push(`${Math.cos(angle) * radius},${-Math.sin(angle) * radius}`)
  }
  return `M${points.join('L')}Z`
}

interface ContextMenuState { x: number; y: number; visible: boolean }

interface Props {
  data: KnowledgeGraphData
  isLoading: boolean
  onCreateLink: (sourceType: string, sourceId: string, targetType: string, targetId: string) => void
  onDeleteLink?: (linkId: string) => void
  onNodeClick?: (nodeType: string, nodeId: string) => void
  onBackgroundAction?: (action: string) => void
  onSavePositions?: (positions: Record<string, { x: number; y: number }>) => void
  onNodeAction?: (action: string, nodeType: string, nodeId: string) => void
}

export function KnowledgeGraphSVG({ data, isLoading, onCreateLink, onDeleteLink, onNodeClick, onBackgroundAction, onSavePositions, onNodeAction }: Props) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 500 })

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 600, h: 500 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 })

  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])

  const [dragNodeId, setDragNodeId] = useState<string | null>(null)
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false })
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; visible: boolean; node: GraphNode | null }>({ x: 0, y: 0, visible: false, node: null })
  const [legendOpen, setLegendOpen] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
      setViewBox(v => ({ ...v, w: width, h: height }))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Rebuild nodes from data, using server-side saved positions
  useEffect(() => {
    const cx = dims.w / 2
    const cy = dims.h / 2
    const orbit = Math.min(dims.w, dims.h) * 0.38
    const saved = new Map(Object.entries(data.positions || {}))

    const builtNodes = buildGraphNodes(data.aspects, data.goals, data.notes, cx, cy, orbit, saved)
    const nodeIds = new Set(builtNodes.map(n => n.id))
    const builtLinks = buildGraphLinks(data.links, data.goals, builtNodes, nodeIds)

    setNodes(builtNodes)
    setLinks(builtLinks)
  }, [data, dims])

  const svgPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: viewBox.x + (e.clientX - rect.left) * (viewBox.w / rect.width),
      y: viewBox.y + (e.clientY - rect.top) * (viewBox.h / rect.height),
    }
  }, [viewBox])

  const findExistingLink = useCallback((id1: string, id2: string): GraphLink | undefined => {
    return links.find(l =>
      !l.implicit &&
      ((l.sourceId === id1 && l.targetId === id2) || (l.sourceId === id2 && l.targetId === id1))
    )
  }, [links])

  // Debounced position save
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const persistPositions = useCallback((updatedNodes: GraphNode[]) => {
    if (!onSavePositions) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const positions: Record<string, { x: number; y: number }> = {}
      for (const n of updatedNodes) positions[n.id] = { x: n.x, y: n.y }
      onSavePositions(positions)
    }, 500)
  }, [onSavePositions])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()

    if (linkSourceId) {
      const source = nodes.find(n => n.id === linkSourceId)
      const target = nodes.find(n => n.id === nodeId)
      if (source && target && source.id !== target.id) {
        const existing = findExistingLink(source.id, target.id)
        if (existing && onDeleteLink) {
          onDeleteLink(existing.id)
        } else if (!existing) {
          onCreateLink(source.nodeType, source.id, target.nodeType, target.id)
        }
      }
      setLinkSourceId(null)
      return
    }

    setDragNodeId(nodeId)
    const startPt = svgPoint(e)
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    const offsetX = startPt.x - node.x
    const offsetY = startPt.y - node.y

    const onMove = (me: MouseEvent) => {
      const pt = svgPoint(me)
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x: pt.x - offsetX, y: pt.y - offsetY } : n))
    }

    const onUp = () => {
      setDragNodeId(null)
      setNodes(prev => { persistPositions(prev); return prev })
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [linkSourceId, nodes, svgPoint, onCreateLink, onDeleteLink, findExistingLink, persistPositions])

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (onNodeClick) {
      const node = nodes.find(n => n.id === nodeId)
      if (node) onNodeClick(node.nodeType, node.id)
    }
  }, [nodes, onNodeClick])

  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setLinkSourceId(prev => prev === nodeId ? null : nodeId)
  }, [])

  useEffect(() => {
    if (!contextMenu.visible && !nodeMenu.visible) return
    const close = () => {
      setContextMenu(prev => ({ ...prev, visible: false }))
      setNodeMenu(prev => ({ ...prev, visible: false, node: null }))
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [contextMenu.visible, nodeMenu.visible])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLinkSourceId(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const didDragRef = useRef(false)

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setContextMenu(prev => ({ ...prev, visible: false }))
    if (linkSourceId) { setLinkSourceId(null); return }
    didDragRef.current = false
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y }
  }, [linkSourceId, viewBox])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos(svgPoint(e))
    if (!isPanning) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setViewBox(v => ({
      ...v,
      x: panStart.current.vx - dx * (v.w / rect.width),
      y: panStart.current.vy - dy * (v.h / rect.height),
    }))
  }, [isPanning, svgPoint])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const wasPanning = isPanning
    setIsPanning(false)
    if (wasPanning && !didDragRef.current && e.button === 0) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true })
    }
  }, [isPanning])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.1 : 0.9
    const pt = svgPoint(e)
    setViewBox(v => ({ x: pt.x - (pt.x - v.x) * factor, y: pt.y - (pt.y - v.y) * factor, w: v.w * factor, h: v.h * factor }))
  }, [svgPoint])

  const connectedTo = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of links) {
      if (!map.has(link.sourceId)) map.set(link.sourceId, new Set())
      if (!map.has(link.targetId)) map.set(link.targetId, new Set())
      map.get(link.sourceId)!.add(link.targetId)
      map.get(link.targetId)!.add(link.sourceId)
    }
    return map
  }, [links])

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])

  if (isLoading) {
    return <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: '14px' }}>Loading graph...</div>
  }

  const bg = colors.bgPrimary

  return (
    <div ref={containerRef} style={{ flex: 1, borderRadius: '12px', border: `1px solid ${colors.border}`, overflow: 'hidden', background: bg, position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        width="100%" height="100%"
        style={{ cursor: isPanning ? 'grabbing' : linkSourceId ? 'crosshair' : 'default' }}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Links */}
        {links.map(link => {
          const s = nodeMap.get(link.sourceId)
          const t = nodeMap.get(link.targetId)
          if (!s || !t) return null
          const isHighlighted = hoveredNodeId && (link.sourceId === hoveredNodeId || link.targetId === hoveredNodeId)
          const isDimmed = hoveredNodeId && !isHighlighted
          return (
            <line key={link.id} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={isDimmed ? hexToRgba(colors.textTertiary, 0.05) : isHighlighted ? hexToRgba(s.color, 0.6) : hexToRgba(colors.textTertiary, link.implicit ? 0.1 : 0.3)}
              strokeWidth={isHighlighted ? 2 : link.implicit ? 0.5 : 1.5}
              strokeDasharray={link.implicit ? '3 3' : 'none'}
            />
          )
        })}

        {/* Link preview */}
        {linkSourceId && (() => {
          const src = nodeMap.get(linkSourceId)
          if (!src) return null
          return <line x1={src.x} y1={src.y} x2={mousePos.x} y2={mousePos.y} stroke={hexToRgba(src.color, 0.5)} strokeWidth={2} strokeDasharray="6 3" pointerEvents="none" />
        })()}

        {/* Nodes */}
        {nodes.map(node => {
          const isHovered = hoveredNodeId === node.id
          const isLinkSource = linkSourceId === node.id
          const isConnected = hoveredNodeId ? connectedTo.get(hoveredNodeId)?.has(node.id) : false
          const isDimmed = hoveredNodeId && !isHovered && !isConnected && hoveredNodeId !== node.id
          const labelY = node.y + node.radius + (node.nodeType === 'aspect' ? 14 : 10)

          return (
            <g key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onClick={(e) => handleNodeClick(e, node.id)}
              onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const rect = containerRef.current?.getBoundingClientRect()
                if (rect) setNodeMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true, node })
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: dragNodeId === node.id ? 'grabbing' : 'pointer' }}
            >
              {isLinkSource && <circle cx={node.x} cy={node.y} r={node.radius + 4} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="4 2" />}
              {node.nodeType === 'aspect' && !isLinkSource && <circle cx={node.x} cy={node.y} r={node.radius + 3} fill="none" stroke={hexToRgba(node.color, 0.3)} strokeWidth={1.5} />}

              {node.nodeType === 'goal' ? (
                <path d={starPath(node.radius)} transform={`translate(${node.x},${node.y})`}
                  fill={node.color} opacity={isDimmed ? 0.15 : 1}
                  stroke={isHovered ? (isDarkMode ? '#fff' : '#000') : 'none'} strokeWidth={isHovered ? 1.5 : 0} />
              ) : node.isScribe ? (
                <>
                  <circle cx={node.x} cy={node.y} r={node.radius + 1}
                    fill="none" stroke={node.color} strokeWidth={1.2} strokeDasharray="3 2"
                    opacity={isDimmed ? 0.15 : 0.7} />
                  <circle cx={node.x} cy={node.y} r={node.radius * 0.6}
                    fill={node.color} opacity={isDimmed ? 0.1 : 0.5} />
                </>
              ) : (
                <circle cx={node.x} cy={node.y} r={node.radius}
                  fill={node.color} opacity={isDimmed ? 0.15 : 1}
                  stroke={isHovered ? (isDarkMode ? '#fff' : '#000') : 'none'} strokeWidth={isHovered ? 1.5 : 0} />
              )}

              {node.nodeType === 'aspect' && (
                <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="11" fontWeight="700" pointerEvents="none">
                  {node.label.charAt(0).toUpperCase()}
                </text>
              )}

              {/* Always show label */}
              <text x={node.x} y={labelY} textAnchor="middle" pointerEvents="none"
                fill={hexToRgba(colors.textPrimary, isDimmed ? 0.1 : isHovered ? 1 : node.nodeType === 'aspect' ? 0.8 : 0.6)}
                fontSize={node.nodeType === 'aspect' ? '10' : '9'}
                fontWeight={node.nodeType === 'aspect' ? '600' : '500'}
              >
                {node.label.length > 20 ? node.label.slice(0, 18) + '...' : node.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Link mode indicator */}
      {linkSourceId && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', padding: '4px 12px', borderRadius: '6px', background: hexToRgba('#f59e0b', 0.15), border: '1px solid #f59e0b', color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>
          Click another node to link/unlink (Esc to cancel)
        </div>
      )}

      {/* Context menu */}
      {contextMenu.visible && (
        <div style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 50, minWidth: '140px', overflow: 'hidden' }}
          onMouseDown={(e) => e.stopPropagation()}>
          <MenuBtn label="New Note" icon="plus" isDarkMode={isDarkMode} colors={colors} onClick={() => { setContextMenu({ x: 0, y: 0, visible: false }); onBackgroundAction?.('new-note') }} />
          <MenuBtn label="New Goal" icon="star" isDarkMode={isDarkMode} colors={colors} onClick={() => { setContextMenu({ x: 0, y: 0, visible: false }); onBackgroundAction?.('new-goal') }} />
        </div>
      )}

      {/* Node context menu (right-click) */}
      {nodeMenu.visible && nodeMenu.node && (
        <div style={{ position: 'absolute', top: nodeMenu.y, left: nodeMenu.x, background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 50, minWidth: '140px', overflow: 'hidden' }}
          onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: '6px 14px', fontSize: '11px', color: colors.textTertiary, borderBottom: `1px solid ${colors.border}` }}>
            {nodeMenu.node.label.length > 20 ? nodeMenu.node.label.slice(0, 18) + '...' : nodeMenu.node.label}
          </div>
          {nodeMenu.node.nodeType === 'aspect' && (
            <MenuBtn label="Archive Aspect" icon="archive" isDarkMode={isDarkMode} colors={colors} onClick={() => {
              const n = nodeMenu.node!
              setNodeMenu({ x: 0, y: 0, visible: false, node: null })
              onNodeAction?.('archive', n.nodeType, n.id)
            }} />
          )}
          {nodeMenu.node.nodeType === 'goal' && (
            <MenuBtn label="Delete Goal" icon="trash" isDarkMode={isDarkMode} colors={colors} onClick={() => {
              const n = nodeMenu.node!
              setNodeMenu({ x: 0, y: 0, visible: false, node: null })
              onNodeAction?.('delete', n.nodeType, n.id)
            }} />
          )}
          {nodeMenu.node.nodeType === 'note' && (
            <MenuBtn label="Delete Note" icon="trash" isDarkMode={isDarkMode} colors={colors} onClick={() => {
              const n = nodeMenu.node!
              setNodeMenu({ x: 0, y: 0, visible: false, node: null })
              onNodeAction?.('delete', n.nodeType, n.id)
            }} />
          )}
        </div>
      )}

      {/* Help button */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        <button onClick={() => setLegendOpen(prev => !prev)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textSecondary, fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ?
        </button>
        {legendOpen && (
          <div style={{ position: 'absolute', top: 34, right: 0, width: 220, background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '12px', fontSize: '11px', color: colors.textSecondary, lineHeight: '1.5' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: colors.textPrimary, fontSize: '12px' }}>Graph Legend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14"><circle cx="7" cy="7" r="6" fill={colors.textTertiary} /><circle cx="7" cy="7" r="6" fill="none" stroke={hexToRgba(colors.textTertiary, 0.3)} /></svg>
              Large circle = Aspect
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14"><path d={starPath(6)} transform="translate(7,7)" fill={colors.textTertiary} /></svg>
              Star = Goal
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <svg width="14" height="14"><circle cx="7" cy="7" r="4" fill={colors.textTertiary} /></svg>
              Small circle = Note
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="none" stroke={colors.textTertiary} strokeWidth="1" strokeDasharray="2 2" /><circle cx="7" cy="7" r="2.5" fill={colors.textTertiary} opacity="0.5" /></svg>
              Dashed circle = Scribe note
            </div>
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 8, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={colors.textTertiary} strokeWidth="1.5" /></svg>
                Solid line = explicit link
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={colors.textTertiary} strokeWidth="1" strokeDasharray="3 3" /></svg>
                Dotted = same aspect affinity
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 8, marginTop: 8, fontSize: '10px' }}>
              <div>Drag nodes to rearrange</div>
              <div>Double-click to start linking</div>
              <div>Link existing connection to remove it</div>
              <div>Click empty space for menu</div>
              <div>Scroll to zoom</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MenuBtn({ label, icon, isDarkMode, colors, onClick }: { label: string; icon: string; isDarkMode: boolean; colors: any; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: '100%', padding: '10px 14px', background: hovered ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent', border: 'none', color: icon === 'trash' ? '#ef4444' : colors.textPrimary, fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={icon === 'trash' ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon === 'plus' && (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>)}
        {icon === 'star' && <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />}
        {icon === 'trash' && (<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></>)}
        {icon === 'archive' && (<><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></>)}
      </svg>
      {label}
    </button>
  )
}
