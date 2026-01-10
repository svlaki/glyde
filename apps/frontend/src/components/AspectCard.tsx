import { useDarkMode } from '../lib/darkModeContext'
import { Category } from '../lib/categoryService'
import { getColors } from '../styles/colors'

interface AspectCardProps {
  aspect: Category
  isSelected: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}

export function AspectCard({ aspect, isSelected, onClick, onEdit, onDelete }: AspectCardProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

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
        {aspect.icon && (
          <span style={{ fontSize: '20px' }}>{aspect.icon}</span>
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.textPrimary,
            marginBottom: '2px'
          }}>
            {aspect.name}
          </div>
          {aspect.description && (
            <div style={{
              fontSize: '12px',
              color: colors.textSecondary,
              lineHeight: '1.4'
            }}>
              {aspect.description}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
