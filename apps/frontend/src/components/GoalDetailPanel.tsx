import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import type { Goal } from '../lib/goalService'
import { EmptyState } from './EmptyState'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight, lineHeight } from '../styles/typography'
import { EditButton, DeleteButton } from './ui/IconButtons'

interface GoalDetailPanelProps {
  goal: Goal | null
  onEdit: () => void
  onDelete: () => void
  onUpdate?: () => void
}

export function GoalDetailPanel({ goal, onEdit, onDelete, onUpdate }: GoalDetailPanelProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { getAspectColor } = useAspects()

  const aspectColor = goal?.aspect ? getAspectColor(goal.aspect) : undefined

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
      {/* Header - title + actions inline */}
      <div style={{
        paddingBottom: '16px',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.normal,
              color: colors.textPrimary,
              margin: 0,
              lineHeight: lineHeight.tight
            }}>
              {goal.title}
            </h2>
            {goal.aspect && aspectColor && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '8px',
              }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: aspectColor,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: fontSize.sm,
                  color: colors.textSecondary,
                }}>
                  {goal.aspect}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <EditButton onClick={onEdit} title="Edit goal" />
            <DeleteButton onClick={onDelete} title="Delete goal" />
          </div>
        </div>
      </div>

      {/* Description */}
      {goal.description && (
        <div style={{
          fontSize: fontSize.base,
          color: colors.textSecondary,
          lineHeight: lineHeight.relaxed,
          whiteSpace: 'pre-wrap'
        }}>
          {goal.description}
        </div>
      )}

    </div>
  )
}
