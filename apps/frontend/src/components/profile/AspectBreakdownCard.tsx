import { useState, useEffect } from 'react'
import { useDarkMode } from '../../lib/darkModeContext'
import { useAspects } from '../../lib/aspectContext'
import { useAuth } from '../../lib/authContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import { AspectBreakdown } from '../../hooks/useProfileData'
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

function AspectRow({
  item,
  maxActivity,
  onArchive,
  archiving,
}: {
  item: AspectBreakdown
  maxActivity: number
  onArchive: (id: string) => void
  archiving: string | null
}) {
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const { getAspectColor } = useAspects()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)
  const [hovered, setHovered] = useState(false)

  const activity = item.eventCount + item.taskCount + item.goalCount
  const barWidth = maxActivity > 0 ? (activity / maxActivity) * 100 : 0
  const aspectColor = getAspectColor(item.categoryName)
  const barBg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const isArchiving = archiving === item.categoryId

  return (
    <div
      style={{ padding: '6px 0' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '2px',
            background: aspectColor,
            flexShrink: 0,
          }} />
          <span style={{ ...typography.bodySm, color: colors.textPrimary }}>
            {item.categoryName}
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            ...typography.labelMd,
            color: colors.textTertiary,
            display: 'flex',
            gap: '8px',
          }}>
            {item.eventCount > 0 && <span>{item.eventCount} event{item.eventCount !== 1 ? 's' : ''}</span>}
            {item.taskCount > 0 && <span>{item.taskCount} task{item.taskCount !== 1 ? 's' : ''}</span>}
            {item.goalCount > 0 && <span>{item.goalCount} goal{item.goalCount !== 1 ? 's' : ''}</span>}
            {activity === 0 && <span>No activity</span>}
          </div>
          {hovered && (
            <button
              onClick={() => onArchive(item.categoryId)}
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
      <div style={{
        height: '4px',
        borderRadius: '2px',
        background: barBg,
      }}>
        {barWidth > 0 && (
          <div style={{
            height: '100%',
            borderRadius: '2px',
            background: aspectColor,
            width: `${barWidth}%`,
            opacity: 0.7,
            transition: 'width 0.3s ease',
          }} />
        )}
      </div>
    </div>
  )
}

export function AspectBreakdownCard({ breakdown }: AspectBreakdownCardProps) {
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const { user, session } = useAuth()
  const { refreshAspects } = useAspects()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)

  const [archiving, setArchiving] = useState<string | null>(null)
  const [archivedAspects, setArchivedAspects] = useState<Aspect[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const maxActivity = Math.max(...breakdown.map(b => b.eventCount + b.taskCount + b.goalCount), 1)

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
      background: colors.bgPrimary,
      border: `1px solid ${borderColor}`,
      borderRadius: '6px',
      overflow: 'hidden',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {breakdown.map(item => (
              <AspectRow
                key={item.categoryId}
                item={item}
                maxActivity={maxActivity}
                onArchive={handleArchive}
                archiving={archiving}
              />
            ))}
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
