import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../../lib/themeContext'
import { useAspects } from '../../lib/aspectContext'
import { useAuth } from '../../lib/authContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import type { AspectBreakdown } from '../../hooks/useProfileData'
import { archiveUserAspect, unarchiveUserAspect, fetchArchivedAspects } from '../../lib/aspectService'
import type { Aspect } from '../../lib/aspectService'

interface AspectBreakdownCardProps {
  breakdown: AspectBreakdown[]
}

const ArchiveIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" />
    <path d="M10 12h4" />
  </svg>
)

const RestoreIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 119 9" />
    <polyline points="3 7 3 12 8 12" />
  </svg>
)

const ChevronIcon = ({ size = 14, color = 'currentColor', expanded }: { size?: number; color?: string; expanded: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

interface SliceData {
  id: string
  name: string
  activity: number
  color: string
  eventCount: number
  taskCount: number
  goalCount: number
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180
  const endRad = ((endAngle - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

function PieChart({
  slices,
  size,
  hoveredSlice,
  onHoverSlice,
}: {
  slices: SliceData[]
  size: number
  hoveredSlice: string | null
  onHoverSlice: (id: string | null) => void
}) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 2

  const totalActivity = slices.reduce((sum, s) => sum + s.activity, 0)

  if (totalActivity === 0) {
    const emptyColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill={emptyColor} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          fill={colors.textTertiary} fontSize="11">
          No activity
        </text>
      </svg>
    )
  }

  let currentAngle = 0
  const paths = slices
    .filter(s => s.activity > 0)
    .map(slice => {
      const sweepAngle = (slice.activity / totalActivity) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + sweepAngle
      currentAngle = endAngle

      const isHovered = hoveredSlice === slice.id
      const scale = isHovered ? 'scale(1.03)' : 'scale(1)'

      // For a single full-circle slice, draw a circle instead of arc
      if (sweepAngle >= 359.99) {
        return (
          <circle
            key={slice.id}
            cx={cx}
            cy={cy}
            r={r}
            fill={slice.color}
            opacity={hoveredSlice && !isHovered ? 0.5 : 0.85}
            style={{
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              transform: scale,
              transformOrigin: `${cx}px ${cy}px`,
              cursor: 'pointer',
            }}
            onMouseEnter={() => onHoverSlice(slice.id)}
            onMouseLeave={() => onHoverSlice(null)}
          />
        )
      }

      return (
        <path
          key={slice.id}
          d={describeArc(cx, cy, r, startAngle, endAngle)}
          fill={slice.color}
          opacity={hoveredSlice && !isHovered ? 0.5 : 0.85}
          style={{
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            transform: scale,
            transformOrigin: `${cx}px ${cy}px`,
            cursor: 'pointer',
          }}
          onMouseEnter={() => onHoverSlice(slice.id)}
          onMouseLeave={() => onHoverSlice(null)}
        />
      )
    })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  )
}

export function AspectBreakdownCard({ breakdown }: AspectBreakdownCardProps) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const { user, session } = useAuth()
  const { refreshAspects, getAspectColor } = useAspects()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const [archiving, setArchiving] = useState<string | null>(null)
  const [archivedAspects, setArchivedAspects] = useState<Aspect[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null)

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const slices = useMemo<SliceData[]>(() =>
    breakdown.map(item => ({
      id: item.categoryId,
      name: item.categoryName,
      activity: item.eventCount + item.taskCount + item.goalCount,
      color: getAspectColor(item.categoryName),
      eventCount: item.eventCount,
      taskCount: item.taskCount,
      goalCount: item.goalCount,
    })),
    [breakdown, getAspectColor]
  )

  const chartSize = isMobile ? 160 : 200

  const loadArchivedAspects = async () => {
    if (!user) return
    setLoadingArchived(true)
    try {
      const result = await fetchArchivedAspects(user, session?.access_token || undefined)
      setArchivedAspects(result.aspects)
    } catch {
      // silently fail
    } finally {
      setLoadingArchived(false)
    }
  }

  useEffect(() => {
    loadArchivedAspects()
  }, [user?.id])

  const handleArchive = async (aspectId: string) => {
    if (!user) return
    setArchiving(aspectId)
    try {
      const result = await archiveUserAspect(user, aspectId, session?.access_token || undefined)
      if (result.success) {
        await refreshAspects()
        await loadArchivedAspects()
      }
    } catch {
      // silently fail
    } finally {
      setArchiving(null)
    }
  }

  const handleUnarchive = async (aspectId: string) => {
    if (!user) return
    setRestoring(aspectId)
    try {
      const result = await unarchiveUserAspect(user, aspectId, session?.access_token || undefined)
      if (result.success) {
        await refreshAspects()
        await loadArchivedAspects()
      }
    } catch {
      // silently fail
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div style={{
      background: colors.bgSecondary,
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: isDarkMode
        ? '0 2px 8px rgba(0,0,0,0.3)'
        : '0 1px 4px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.03)',
    }}>
      <div style={{
        padding: isMobile ? '14px 16px 10px' : '16px 20px 12px',
      }}>
        <div style={{ ...typography.headingMd, color: colors.textPrimary }}>
          Aspects
        </div>
      </div>

      <div style={{ padding: isMobile ? '0 16px 14px' : '0 20px 16px' }}>
        {breakdown.length === 0 ? (
          <div style={{ ...typography.bodySm, color: colors.textTertiary, padding: '8px 0' }}>
            No aspects configured yet
          </div>
        ) : (
          <div style={{
            display: 'flex',
            gap: isMobile ? '16px' : '24px',
            alignItems: 'flex-start',
          }}>
            {/* Pie Chart */}
            <div style={{ flexShrink: 0 }}>
              <PieChart
                slices={slices}
                size={chartSize}
                hoveredSlice={hoveredSlice}
                onHoverSlice={setHoveredSlice}
              />
            </div>

            {/* Legend */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: 0,
            }}>
              {slices.map(slice => (
                  <LegendItem
                    key={slice.id}
                    slice={slice}
                    isHovered={hoveredSlice === slice.id}
                    onHover={setHoveredSlice}
                    onArchive={handleArchive}
                    archiving={archiving}
                  />
              ))}
            </div>
          </div>
        )}

        {archivedAspects.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: `1px solid ${borderColor}`, paddingTop: '10px' }}>
            <button
              onClick={() => setShowArchived(prev => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0',
                color: colors.textTertiary,
                ...typography.labelMd,
              }}
            >
              <ChevronIcon size={12} color={colors.textTertiary} expanded={showArchived} />
              Archived ({archivedAspects.length})
            </button>

            {showArchived && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {loadingArchived ? (
                  <div style={{ ...typography.bodySm, color: colors.textTertiary, padding: '4px 0' }}>
                    Loading...
                  </div>
                ) : (
                  archivedAspects.map(aspect => (
                    <div key={aspect.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '2px',
                          background: aspect.color,
                          opacity: 0.5,
                          flexShrink: 0,
                        }} />
                        <span style={{ ...typography.bodySm, color: colors.textTertiary }}>
                          {aspect.name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnarchive(aspect.id)}
                        disabled={restoring === aspect.id}
                        title="Restore aspect"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: restoring === aspect.id ? 'default' : 'pointer',
                          padding: '2px',
                          opacity: restoring === aspect.id ? 0.4 : 0.6,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <RestoreIcon size={14} color={colors.textTertiary} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LegendItem({
  slice,
  isHovered,
  onHover,
  onArchive,
  archiving,
}: {
  slice: SliceData
  isHovered: boolean
  onHover: (id: string | null) => void
  onArchive: (id: string) => void
  archiving: string | null
}) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)
  const [rowHovered, setRowHovered] = useState(false)

  const isArchiving = archiving === slice.id
  const highlightBg = isHovered
    ? isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
    : 'transparent'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 6px',
        borderRadius: '4px',
        background: highlightBg,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={() => { onHover(slice.id); setRowHovered(true) }}
      onMouseLeave={() => { onHover(null); setRowHovered(false) }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: slice.color,
          flexShrink: 0,
          opacity: 0.85,
        }} />
        <span style={{
          ...typography.bodySm,
          color: colors.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {slice.name}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <div style={{
          ...typography.labelMd,
          color: colors.textTertiary,
          display: 'flex',
          gap: '6px',
        }}>
          {slice.eventCount > 0 && <span>{slice.eventCount} event{slice.eventCount !== 1 ? 's' : ''}</span>}
          {slice.taskCount > 0 && <span>{slice.taskCount} task{slice.taskCount !== 1 ? 's' : ''}</span>}
          {slice.goalCount > 0 && <span>{slice.goalCount} goal{slice.goalCount !== 1 ? 's' : ''}</span>}
          {slice.activity === 0 && <span>No activity</span>}
        </div>
        {rowHovered && (
          <button
            onClick={() => onArchive(slice.id)}
            disabled={isArchiving}
            title="Archive aspect"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isArchiving ? 'default' : 'pointer',
              padding: '2px',
              opacity: isArchiving ? 0.4 : 0.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArchiveIcon size={14} color={colors.textTertiary} />
          </button>
        )}
      </div>
    </div>
  )
}
