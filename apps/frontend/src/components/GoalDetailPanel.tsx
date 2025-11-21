import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { Goal } from '../lib/goalService'
import { EmptyState } from './EmptyState'
import { getColors, hexToRgba } from '../styles/colors'

interface GoalDetailPanelProps {
  goal: Goal | null
  onEdit: () => void
  onDelete: () => void
}

export function GoalDetailPanel({ goal, onEdit, onDelete }: GoalDetailPanelProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { getCategoryColor } = useCategories()

  const aspectColor = goal?.category ? getCategoryColor(goal.category) : undefined

  if (!goal) {
    return (
      <EmptyState
        title="No goal selected"
        description="Select a goal from the list to view its details"
      />
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Header */}
      <div style={{
        paddingBottom: '16px',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '400',
          color: colors.textPrimary,
          margin: '0 0 16px 0',
          lineHeight: '1.3'
        }}>
          {goal.title}
        </h2>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            onClick={onEdit}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '400',
              background: 'transparent',
              color: colors.textSecondary,
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '400',
              background: 'transparent',
              color: colors.textSecondary,
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              opacity: 0.5
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Description */}
      {goal.description && (
        <div style={{
          fontSize: '14px',
          color: colors.textSecondary,
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap'
        }}>
          {goal.description}
        </div>
      )}
    </div>
  )
}
