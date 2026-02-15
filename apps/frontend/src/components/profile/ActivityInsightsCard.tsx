import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { getTypography, fontFamily } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'
import { TaskInsights } from '../../hooks/useProfileData'

interface ActivityInsightsCardProps {
  taskInsights: TaskInsights
}

interface StatCellProps {
  label: string
  value: number
  detail: string
  warning?: boolean
}

function StatCell({ label, value, detail, warning }: StatCellProps) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  return (
    <div style={{
      padding: isMobile ? '12px' : '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{
        ...typography.labelMd,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: fontFamily.serif,
        fontSize: isMobile ? '28px' : '32px',
        fontWeight: 600,
        lineHeight: 1.1,
        color: warning ? colors.warning : colors.textPrimary,
      }}>
        {value}
      </div>
      <div style={{ ...typography.bodySm, color: colors.textTertiary }}>
        {detail}
      </div>
    </div>
  )
}

function CompletionRateCell({ rate, taskInsights }: { rate: number; taskInsights: TaskInsights }) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const barBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const barFill = colors.success

  return (
    <div style={{
      padding: isMobile ? '12px' : '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{
        ...typography.labelMd,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        Completion Rate
      </div>
      <div style={{
        fontFamily: fontFamily.serif,
        fontSize: isMobile ? '28px' : '32px',
        fontWeight: 600,
        lineHeight: 1.1,
        color: colors.textPrimary,
      }}>
        {rate}%
      </div>
      <div style={{
        height: '4px',
        borderRadius: '2px',
        background: barBg,
        marginTop: '4px',
      }}>
        <div style={{
          height: '100%',
          borderRadius: '2px',
          background: barFill,
          width: `${Math.min(rate, 100)}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

export function ActivityInsightsCard({ taskInsights }: ActivityInsightsCardProps) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const borderColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

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
          Activity
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}>
        <div style={{ borderRight: `1px solid ${borderColor}`, borderTop: `1px solid ${borderColor}` }}>
          <StatCell
            label="Completed"
            value={taskInsights.completedTasks}
            detail={`${taskInsights.tasksCompletedThisWeek} this week`}
          />
        </div>
        <div style={{ borderTop: `1px solid ${borderColor}` }}>
          <CompletionRateCell rate={taskInsights.completionRate} taskInsights={taskInsights} />
        </div>
        <div style={{ borderRight: `1px solid ${borderColor}`, borderTop: `1px solid ${borderColor}` }}>
          <StatCell
            label="Active Tasks"
            value={taskInsights.pendingTasks}
            detail={`${taskInsights.highPriorityPending} high priority`}
          />
        </div>
        <div style={{ borderTop: `1px solid ${borderColor}` }}>
          <StatCell
            label="Overdue"
            value={taskInsights.overdueTasks}
            detail={taskInsights.overdueTasks > 0 ? 'Need attention' : 'All on track'}
            warning={taskInsights.overdueTasks > 0}
          />
        </div>
      </div>
    </div>
  )
}
