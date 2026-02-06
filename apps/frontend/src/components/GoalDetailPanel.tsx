import { useDarkMode } from '../lib/darkModeContext'
import { useAspects } from '../lib/aspectContext'
import { useAuth } from '../lib/authContext'
import { updateUserGoal } from '../lib/goalService'
import type { Goal } from '../lib/goalService'
import { EmptyState } from './EmptyState'
import { getColors, hexToRgba } from '../styles/colors'
import { fontSize, fontWeight, lineHeight } from '../styles/typography'
import { EditButton, DeleteButton } from './ui/IconButtons'

interface GoalDetailPanelProps {
  goal: Goal | null
  onEdit: () => void
  onDelete: () => void
  onUpdate?: () => void
}

export function GoalDetailPanel({ goal, onEdit, onDelete, onUpdate }: GoalDetailPanelProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { getAspectColor } = useAspects()
  const { user, session } = useAuth()

  const aspectColor = goal?.aspect ? getAspectColor(goal.aspect) : undefined

  const toggleMilestone = async (index: number) => {
    if (!goal || !goal.milestones || !user || !session?.access_token) return

    const updatedMilestones = goal.milestones.map((m, i) =>
      i === index ? { ...m, completed: !m.completed } : m
    )

    const result = await updateUserGoal(user, session.access_token, goal.id, {
      milestones: updatedMilestones
    })

    if (!result.error && onUpdate) {
      onUpdate()
    }
  }

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
          fontSize: fontSize.lg,
          fontWeight: fontWeight.normal,
          color: colors.textPrimary,
          margin: '0 0 16px 0',
          lineHeight: lineHeight.tight
        }}>
          {goal.title}
        </h2>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <EditButton onClick={onEdit} title="Edit goal" />
          <DeleteButton onClick={onDelete} title="Delete goal" />
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

      {/* Milestones */}
      {goal.milestones && goal.milestones.length > 0 && (
        <div style={{
          paddingTop: '16px',
          borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
        }}>
          <h3 style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.medium,
            color: colors.textPrimary,
            margin: '0 0 12px 0'
          }}>
            {goal.milestone_type === 'ordered' ? 'Steps' : 'Milestones'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {goal.milestones.map((milestone, index) => (
              <div
                key={index}
                onClick={() => toggleMilestone(index)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderRadius: '6px',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                }}
              >
                {goal.milestone_type === 'ordered' ? (
                  /* Ordered milestones: Show step number with checkmark overlay when completed */
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: milestone.completed ? (aspectColor || colors.accent) : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px',
                    transition: 'all 0.15s ease',
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: milestone.completed ? '#fff' : colors.textSecondary
                  }}>
                    {milestone.completed ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                ) : (
                  /* Dated milestones: Show checkbox */
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${milestone.completed ? (aspectColor || colors.accent) : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')}`,
                    background: milestone.completed ? (aspectColor || colors.accent) : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px',
                    transition: 'all 0.15s ease'
                  }}>
                    {milestone.completed && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.normal,
                    color: milestone.completed ? colors.textSecondary : colors.textPrimary,
                    textDecoration: milestone.completed ? 'line-through' : 'none'
                  }}>
                    {milestone.title}
                  </div>
                  {goal.milestone_type !== 'ordered' && milestone.due_date && (
                    <div style={{
                      fontSize: fontSize.xs,
                      color: colors.textTertiary,
                      marginTop: '2px'
                    }}>
                      Due: {new Date(milestone.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
