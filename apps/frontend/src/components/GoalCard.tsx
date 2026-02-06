import { useDarkMode } from '../lib/darkModeContext'
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
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)
  const { getAspectColor } = useAspects()

  const aspectColor = goal.aspect ? getAspectColor(goal.aspect) : undefined

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
        ...typography.bodyMd,
        fontWeight: fontWeight.normal,
        color: colors.textPrimary,
        lineHeight: lineHeight.tight
      }}>
        {goal.title}
      </div>

      {/* Goal Description Preview - Only show if selected */}
      {isSelected && goal.description && (
        <div style={{
          ...typography.bodySm,
          color: colors.textSecondary,
          lineHeight: lineHeight.normal,
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
