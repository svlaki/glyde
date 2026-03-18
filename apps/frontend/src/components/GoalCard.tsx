import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import type { Goal } from '../lib/goalService'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontWeight, lineHeight } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'

interface GoalCardProps {
  goal: Goal
  isSelected: boolean
  onClick: () => void
}

export function GoalCard({ goal, isSelected, onClick }: GoalCardProps) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)
  const { getAspectColor } = useAspects()

  const aspectColor = goal.aspect ? getAspectColor(goal.aspect) : undefined
  const goalAny = goal as any

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}`
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px',
        background: aspectColor
          ? `linear-gradient(to right, ${hexToRgba(aspectColor, isDarkMode ? 0.15 : 0.08)}, ${colors.bgPrimary})`
          : colors.bgPrimary,
        border: isSelected
          ? `1px solid ${aspectColor ? hexToRgba(aspectColor, 0.5) : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')}`
          : `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        borderLeft: aspectColor ? `3px solid ${aspectColor}` : `3px solid transparent`,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Goal Title */}
      <div style={{
        ...typography.bodyMd,
        fontWeight: fontWeight.medium,
        color: colors.textPrimary,
        lineHeight: lineHeight.tight
      }}>
        {goal.title}
      </div>

      {/* Meta row: aspect badge + due date */}
      {(goal.aspect || goalAny.due_date) && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '6px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          {goal.aspect && aspectColor && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: colors.textSecondary,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: aspectColor,
                flexShrink: 0,
              }} />
              {goal.aspect}
            </span>
          )}
          {goalAny.due_date && (
            <span style={{ fontSize: '12px', color: colors.textTertiary }}>
              Due {formatDueDate(goalAny.due_date)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
