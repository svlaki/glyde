import { useDarkMode } from '../lib/darkModeContext'
import type { Aspect } from '../lib/aspectService'
import { getColors } from '../styles/colors'
import { getTypography, fontWeight, lineHeight } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'

interface AspectCardProps {
  aspect: Aspect
  isSelected: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}

export function AspectCard({ aspect, isSelected, onClick, onEdit, onDelete }: AspectCardProps) {
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        background: isSelected ? colors.bgHover : colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderLeft: `4px solid ${aspect.color || '#999'}`
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = colors.bgHover
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = colors.bgSecondary
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            ...typography.labelLg,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: '2px'
          }}>
            {aspect.name}
          </div>
          {aspect.description && (
            <div style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              lineHeight: lineHeight.tight
            }}>
              {aspect.description}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
