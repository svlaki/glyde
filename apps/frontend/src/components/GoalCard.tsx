import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { Goal } from '../lib/goalService'
import { getColors, hexToRgba } from '../styles/colors'

interface GoalCardProps {
  goal: Goal
  isSelected: boolean
  onClick: () => void
}

export function GoalCard({ goal, isSelected, onClick }: GoalCardProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { getCategoryColor } = useCategories()

  const aspectColor = goal.category ? getCategoryColor(goal.category) : undefined

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        background: aspectColor
          ? `linear-gradient(to right, ${hexToRgba(aspectColor, isDarkMode ? 0.15 : 0.08)}, ${colors.bgPrimary})`
          : colors.bgPrimary,
        border: isSelected
          ? `1px solid ${aspectColor ? hexToRgba(aspectColor, 0.5) : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')}`
          : `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        borderLeft: aspectColor ? `3px solid ${aspectColor}` : `3px solid transparent`
      }}
    >
      {/* Goal Title */}
      <div style={{
        fontSize: '14px',
        fontWeight: '400',
        color: colors.textPrimary,
        lineHeight: '1.4'
      }}>
        {goal.title}
      </div>

      {/* Goal Description Preview - Only show if selected */}
      {isSelected && goal.description && (
        <div style={{
          fontSize: '13px',
          color: colors.textSecondary,
          lineHeight: '1.5',
          marginTop: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          opacity: 0.6
        }}>
          {goal.description}
        </div>
      )}
    </div>
  )
}
