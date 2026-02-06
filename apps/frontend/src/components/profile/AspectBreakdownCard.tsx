import { useDarkMode } from '../../lib/darkModeContext'
import { useAspects } from '../../lib/aspectContext'
import { getColors } from '../../styles/colors'
import { getTypography } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import { AspectBreakdown } from '../../hooks/useProfileData'

interface AspectBreakdownCardProps {
  breakdown: AspectBreakdown[]
}

function AspectRow({ item, maxActivity }: { item: AspectBreakdown; maxActivity: number }) {
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const { getAspectColor } = useAspects()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)

  const activity = item.eventCount + item.taskCount + item.goalCount
  const barWidth = maxActivity > 0 ? (activity / maxActivity) * 100 : 0
  const aspectColor = getAspectColor(item.categoryName)
  const barBg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  return (
    <div style={{ padding: '6px 0' }}>
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
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const maxActivity = Math.max(...breakdown.map(b => b.eventCount + b.taskCount + b.goalCount), 1)

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
              <AspectRow key={item.categoryId} item={item} maxActivity={maxActivity} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
