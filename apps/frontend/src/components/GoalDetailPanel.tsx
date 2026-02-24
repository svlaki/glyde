import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { useAuth } from '../lib/authContext'
import { usePlatform } from '../hooks/usePlatform'
import { updateUserGoal } from '../lib/goalService'
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
  const { user, session } = useAuth()
  const { isMobile } = usePlatform()

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

      {/* Milestones */}
      {goal.milestones && goal.milestones.length > 0 && (
        <div style={{
          paddingTop: '16px',
          borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}>
            <h3 style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.medium,
              color: colors.textPrimary,
              margin: 0,
            }}>
              {goal.milestone_type === 'ordered' ? 'Steps' : 'Milestones'}
            </h3>
            <span style={{
              fontSize: fontSize.sm,
              color: colors.textTertiary,
            }}>
              {goal.milestones.filter(m => m.completed).length} of {goal.milestones.length} complete
            </span>
          </div>

          {isMobile ? (
            /* Mobile: Horizontal scrolling timeline */
            <div style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              margin: '0 -20px',
              padding: '0 20px',
              WebkitOverflowScrolling: 'touch'
            }}>
              <div style={{
                display: 'flex',
                gap: '0',
                paddingBottom: '8px',
                minWidth: 'max-content'
              }}>
                {goal.milestones.map((milestone, index) => {
                  const isLast = index === goal.milestones!.length - 1
                  const nodeColor = milestone.completed ? (aspectColor || colors.accent) : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)')
                  const lineColor = milestone.completed ? (aspectColor || colors.accent) : (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')

                  return (
                    <div
                      key={index}
                      onClick={() => toggleMilestone(index)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        minWidth: '120px',
                        maxWidth: '140px',
                        position: 'relative'
                      }}
                    >
                      {/* Timeline node + connector */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        marginBottom: '10px'
                      }}>
                        {/* Left connector line */}
                        <div style={{
                          flex: 1,
                          height: '2px',
                          background: index === 0 ? 'transparent' : lineColor
                        }} />
                        {/* Node */}
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: milestone.completed ? nodeColor : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                          border: `2px solid ${nodeColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}>
                          {milestone.completed ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            goal.milestone_type === 'ordered' ? (
                              <span style={{
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.semibold,
                                color: colors.textSecondary
                              }}>
                                {index + 1}
                              </span>
                            ) : null
                          )}
                        </div>
                        {/* Right connector line */}
                        <div style={{
                          flex: 1,
                          height: '2px',
                          background: isLast ? 'transparent' : lineColor
                        }} />
                      </div>
                      {/* Label */}
                      <div style={{
                        textAlign: 'center',
                        padding: '0 6px'
                      }}>
                        <div style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.medium,
                          color: milestone.completed ? colors.textSecondary : colors.textPrimary,
                          textDecoration: milestone.completed ? 'line-through' : 'none',
                          lineHeight: lineHeight.tight,
                          wordBreak: 'break-word'
                        }}>
                          {milestone.title}
                        </div>
                        {goal.milestone_type !== 'ordered' && milestone.due_date && (
                          <div style={{
                            fontSize: '10px',
                            color: colors.textTertiary,
                            marginTop: '3px'
                          }}>
                            {new Date(milestone.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Desktop: Vertical list */
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
          )}
        </div>
      )}
    </div>
  )
}
