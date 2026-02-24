import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { fetchUserGoals } from '../lib/goalService'
import type { Goal } from '../lib/goalService'
import { fetchUserEvents } from '../lib/calendarService'
import type { CalendarEvent } from '../lib/calendarService'
import { fetchUserTasks, updateUserTask, completeUserTask, deleteUserTask } from '../lib/taskService'
import type { Task } from '../lib/taskService'
import type { Aspect } from '../lib/aspectService'
import { EmptyState } from './EmptyState'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight, lineHeight } from '../styles/typography'
import { EditButton, DeleteButton, ShareButton } from './ui/IconButtons'

/**
 * Deduplicate recurring event instances - keeps only one card per recurring series.
 * For each parent, picks the next upcoming instance (or most recent if all are past).
 * Non-recurring events pass through unchanged.
 */
function deduplicateRecurringEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = new Date()
  const nonRecurring: CalendarEvent[] = []
  const recurringGroups = new Map<string, CalendarEvent[]>()

  for (const event of events) {
    const parentId = event.parent_event_id
    if (parentId) {
      const group = recurringGroups.get(parentId) || []
      recurringGroups.set(parentId, [...group, event])
    } else if (event.is_recurring) {
      // Parent event that has instances - group by its own id
      const group = recurringGroups.get(event.id) || []
      recurringGroups.set(event.id, [...group, event])
    } else {
      nonRecurring.push(event)
    }
  }

  // For each recurring group, pick the best representative instance
  const representatives: CalendarEvent[] = []
  for (const [, instances] of recurringGroups) {
    // Sort by start_time ascending
    const sorted = [...instances].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )

    // Pick next upcoming instance, or last one if all past
    const upcoming = sorted.find(e => new Date(e.start_time) >= now)
    representatives.push(upcoming || sorted[sorted.length - 1])
  }

  return [...nonRecurring, ...representatives]
}

interface GoalsByAspectProps {
  aspect: Aspect | null
  onEdit?: (() => void) | undefined
  onDelete?: (() => void) | undefined
  onShare?: (() => void) | undefined
  onDescriptionUpdate?: (description: string) => Promise<void>
  onEditEvent?: (event: CalendarEvent) => void
  onEditTask?: (task: Task) => void
  onEditGoal?: (goal: Goal) => void
}

export function GoalsByAspect({ aspect, onEdit, onDelete, onShare, onDescriptionUpdate, onEditEvent, onEditTask, onEditGoal }: GoalsByAspectProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const [goals, setGoals] = useState<Goal[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Reset editing state when aspect changes
  useEffect(() => {
    setEditingDescription(false)
    setDescriptionDraft('')
  }, [aspect?.id])

  useEffect(() => {
    async function loadAspectData() {
      if (!user || !session || !aspect) {
        setGoals([])
        setEvents([])
        setTasks([])
        return
      }

      setLoading(true)
      try {
        // Fetch goals
        const { goals: allGoals } = await fetchUserGoals(user, session.access_token, {})
        const filteredGoals = allGoals.filter(goal =>
          goal.aspect === aspect.name ||
          goal.aspect === aspect.id ||
          goal.aspect === aspect.id?.toString()
        )
        setGoals(filteredGoals)

        // Fetch events
        const { events: allEvents } = await fetchUserEvents(user, session.access_token)
        const filteredEvents = allEvents.filter(event =>
          event.aspect === aspect.name ||
          event.aspect === aspect.id ||
          event.aspect === aspect.id?.toString()
        )

        // Deduplicate recurring event instances - show only one card per series
        // For recurring events, keep only the next upcoming instance (or the most recent if all past)
        const deduplicatedEvents = deduplicateRecurringEvents(filteredEvents)
        setEvents(deduplicatedEvents)

        // Fetch tasks
        const { tasks: allTasks } = await fetchUserTasks(user, session.access_token, {})
        const filteredTasks = allTasks.filter(task =>
          task.aspect === aspect.name ||
          task.aspect === aspect.id ||
          task.aspect === aspect.id?.toString() ||
          task.aspect_name === aspect.name ||
          task.aspect_id === aspect.id ||
          task.aspect_id === aspect.id?.toString()
        )
        setTasks(filteredTasks)
      } catch (error) {
        console.error('Error loading aspect data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAspectData()
  }, [user, session, aspect])

  const reloadTasks = async () => {
    if (!user || !session || !aspect) return
    const { tasks: allTasks } = await fetchUserTasks(user, session.access_token, {})
    const filteredTasks = allTasks.filter(task =>
      task.aspect === aspect.name ||
      task.aspect === aspect.id ||
      task.aspect === aspect.id?.toString() ||
      task.aspect_name === aspect.name ||
      task.aspect_id === aspect.id ||
      task.aspect_id === aspect.id?.toString()
    )
    setTasks(filteredTasks)
  }

  const handleToggleTaskComplete = async (task: Task) => {
    if (!user || !session) return
    if (task.status === 'completed') {
      await updateUserTask(user, session.access_token, task.id, { status: 'pending' })
    } else {
      await completeUserTask(user, session.access_token, task.id)
    }
    await reloadTasks()
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!user || !session) return
    await deleteUserTask(user, session.access_token, taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  if (!aspect) {
    return (
      <EmptyState
        title="No aspect selected"
        description="Select an aspect from the list to view its details"
      />
    )
  }

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: fontSize.base
      }}>
        Loading...
      </div>
    )
  }

  const now = new Date()
  const isRecurringOngoing = (event: CalendarEvent) => {
    if (!event.recurrence_rule && !event.is_recurring) {
      return false
    }
    if (!event.recurrence_end) {
      return true
    }
    const recurrenceEnd = new Date(event.recurrence_end)
    return !Number.isNaN(recurrenceEnd.getTime()) && recurrenceEnd >= now
  }

  const isPastEvent = (event: CalendarEvent) => {
    const end = event.end_time ? new Date(event.end_time) : new Date(event.start_time)
    if (Number.isNaN(end.getTime())) {
      return false
    }
    if (isRecurringOngoing(event)) {
      return false
    }
    return end < now
  }

  const currentEvents = events.filter(event => !isPastEvent(event))
  const pastEvents = events
    .filter(event => isPastEvent(event))
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  const activeTasks = tasks.filter(task => task.status !== 'completed')
  const completedTasks = tasks.filter(task => task.status === 'completed')
  const totalItems = events.length + tasks.length + goals.length

  const toggleSection = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const SectionHeader = ({ sectionKey, label, count }: { sectionKey: string; label: string; count: number }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: '0 0 12px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.textTertiary}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: collapsed[sectionKey] ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
          flexShrink: 0,
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <span style={{
        fontSize: fontSize.base,
        fontWeight: fontWeight.semibold,
        color: colors.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label} ({count})
      </span>
    </button>
  )

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Aspect Description - Click to Edit */}
      {onDescriptionUpdate ? (
        editingDescription ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <textarea
              autoFocus
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingDescription(false)
                  setDescriptionDraft(aspect.description || '')
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  const trimmed = descriptionDraft.trim()
                  if (trimmed !== (aspect.description || '')) {
                    setSavingDescription(true)
                    onDescriptionUpdate(trimmed).finally(() => {
                      setSavingDescription(false)
                      setEditingDescription(false)
                    })
                  } else {
                    setEditingDescription(false)
                  }
                }
              }}
              onBlur={() => {
                const trimmed = descriptionDraft.trim()
                if (trimmed !== (aspect.description || '')) {
                  setSavingDescription(true)
                  onDescriptionUpdate(trimmed).finally(() => {
                    setSavingDescription(false)
                    setEditingDescription(false)
                  })
                } else {
                  setEditingDescription(false)
                }
              }}
              placeholder="Describe this aspect..."
              style={{
                padding: '12px',
                background: colors.bgSecondary,
                border: `1px solid ${aspect.color || colors.accent}`,
                borderRadius: '6px',
                fontSize: fontSize.sm,
                color: colors.textPrimary,
                lineHeight: lineHeight.normal,
                resize: 'vertical',
                minHeight: '60px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              disabled={savingDescription}
            />
            <div style={{
              fontSize: fontSize.xs,
              color: colors.textTertiary
            }}>
              {savingDescription ? 'Saving...' : 'Enter to save, Shift+Enter for new line, Esc to cancel'}
            </div>
          </div>
        ) : (
          <div
            onClick={() => {
              setDescriptionDraft(aspect.description || '')
              setEditingDescription(true)
            }}
            style={{
              padding: '12px',
              background: colors.bgHover,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              fontSize: fontSize.sm,
              color: aspect.description ? colors.textPrimary : colors.textTertiary,
              lineHeight: lineHeight.normal,
              cursor: 'pointer',
              transition: 'border-color 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = aspect.color || colors.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border
            }}
          >
            {aspect.description || 'Click to add a description...'}
          </div>
        )
      ) : (
        aspect.description && (
          <div style={{
            padding: '12px',
            background: colors.bgHover,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            fontSize: fontSize.sm,
            color: colors.textPrimary,
            lineHeight: lineHeight.normal
          }}>
            {aspect.description}
          </div>
        )
      )}
      {/* Stats */}
      <div style={{
        paddingBottom: '16px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: fontSize.sm,
              color: colors.textSecondary,
              display: 'flex',
              gap: '12px'
            }}>
              <span>{events.length} {events.length === 1 ? 'event' : 'events'}</span>
              <span>•</span>
              <span>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
              <span>•</span>
              <span>{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</span>
            </div>
          </div>
          {/* Action Buttons */}
          {(onEdit || onShare || onDelete) && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {onEdit && (
                <EditButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                  title="Edit aspect"
                                  />
              )}
              {onShare && (
                <ShareButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onShare()
                  }}
                  title="Share aspect"
                />
              )}
              {onDelete && (
                <DeleteButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  title="Delete aspect"
                                  />
              )}
            </div>
          )}
        </div>

      </div>

      {/* No items message */}
      {totalItems === 0 && (
        <EmptyState
          title="No items yet"
          description={`No events, tasks, or goals found for the "${aspect.name}" aspect`}
        />
      )}

      {/* Events Section */}
      {currentEvents.length > 0 && (
        <div>
          <SectionHeader sectionKey="events" label="Events" count={currentEvents.length} />
          {!collapsed.events && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {currentEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => onEditEvent?.(event)}
                  style={{
                    padding: '12px 16px',
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    borderLeft: `4px solid ${aspect.color || '#999'}`,
                    transition: 'all 0.2s',
                    cursor: onEditEvent ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.bgSecondary
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                    minWidth: 0,
                  }}>
                    <div style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.textPrimary,
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {event.title}
                    </div>
                    {event.is_recurring && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: colors.bgTertiary,
                        color: colors.textSecondary,
                        fontWeight: fontWeight.medium,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        Recurring
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: fontSize.xs,
                    color: colors.textSecondary
                  }}>
                    {event.is_recurring ? 'Next: ' : ''}
                    {new Date(event.start_time).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                  {event.description && (
                    <div style={{
                      fontSize: fontSize.sm,
                      color: colors.textSecondary,
                      marginTop: '6px',
                      lineHeight: lineHeight.tight
                    }}>
                      {event.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks Section */}
      {activeTasks.length > 0 && (
        <div>
          <SectionHeader sectionKey="tasks" label="Tasks" count={activeTasks.length} />
          {!collapsed.tasks && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {activeTasks.map(task => (
              <div
                key={task.id}
                onClick={() => onEditTask?.(task)}
                style={{
                  padding: '12px 16px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  borderLeft: `4px solid ${aspect.color || '#999'}`,
                  transition: 'all 0.2s',
                  cursor: onEditTask ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.bgSecondary
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={(e) => { e.stopPropagation(); handleToggleTaskComplete(task) }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: aspect.color || colors.accent, flexShrink: 0 }}
                    title="Mark as complete"
                  />
                  <div style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.textPrimary,
                    flex: 1
                  }}>
                    {task.title}
                  </div>
                  {task.status && task.status !== 'pending' && (
                    <span style={{
                      fontSize: fontSize.xs,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: task.status === 'in_progress' ? '#fbbf24' : colors.bgTertiary,
                      color: task.status === 'in_progress' ? '#000' : colors.textSecondary,
                      fontWeight: fontWeight.medium
                    }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id) }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: colors.textTertiary,
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      opacity: 0.5,
                      transition: 'opacity 0.15s, color 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = colors.error }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = colors.textTertiary }}
                    title="Delete task"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                {task.due_date && (
                  <div style={{
                    fontSize: fontSize.xs,
                    color: colors.textSecondary,
                    marginLeft: '24px'
                  }}>
                    Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                )}
                {task.description && (
                  <div style={{
                    fontSize: fontSize.sm,
                    color: colors.textSecondary,
                    marginTop: '6px',
                    marginLeft: '24px',
                    lineHeight: lineHeight.tight
                  }}>
                    {task.description}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Goals Section */}
      {goals.length > 0 && (
        <div>
          <SectionHeader sectionKey="goals" label="Goals" count={goals.length} />
          {!collapsed.goals && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {goals.map(goal => (
                <div
                  key={goal.id}
                  onClick={() => onEditGoal?.(goal)}
                  style={{
                    padding: '12px 16px',
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    borderLeft: `4px solid ${aspect.color || '#999'}`,
                    transition: 'all 0.2s',
                    cursor: onEditGoal ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.bgSecondary
                  }}
                >
                  <div style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.textPrimary,
                    marginBottom: '4px'
                  }}>
                    {goal.title}
                  </div>
                  {goal.description && (
                    <div style={{
                      fontSize: fontSize.sm,
                      color: colors.textSecondary,
                      lineHeight: lineHeight.tight
                    }}>
                      {goal.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div>
          <SectionHeader sectionKey="completedTasks" label="Completed Tasks" count={completedTasks.length} />
          {!collapsed.completedTasks && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {completedTasks.map(task => (
              <div
                key={task.id}
                onClick={() => onEditTask?.(task)}
                style={{
                  padding: '12px 16px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  borderLeft: `4px solid ${aspect.color || '#999'}`,
                  transition: 'all 0.2s',
                  cursor: onEditTask ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.bgSecondary
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={(e) => { e.stopPropagation(); handleToggleTaskComplete(task) }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: aspect.color || colors.accent, flexShrink: 0 }}
                    title="Mark as incomplete"
                  />
                  <div style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.textSecondary,
                    textDecoration: 'line-through',
                    flex: 1
                  }}>
                    {task.title}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id) }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: colors.textTertiary,
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                      opacity: 0.5,
                      transition: 'opacity 0.15s, color 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = colors.error }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = colors.textTertiary }}
                    title="Delete task"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                {task.due_date && (
                  <div style={{
                    fontSize: fontSize.xs,
                    color: colors.textSecondary,
                    marginLeft: '24px'
                  }}>
                    Due: {new Date(task.due_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                )}
                {task.description && (
                  <div style={{
                    fontSize: fontSize.sm,
                    color: colors.textSecondary,
                    marginTop: '6px',
                    marginLeft: '24px',
                    lineHeight: lineHeight.tight
                  }}>
                    {task.description}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Past Events Section */}
      {pastEvents.length > 0 && (
        <div>
          <SectionHeader sectionKey="pastEvents" label="Past Events" count={pastEvents.length} />
          {!collapsed.pastEvents && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {pastEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => onEditEvent?.(event)}
                  style={{
                    padding: '12px 16px',
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    borderLeft: `4px solid ${aspect.color || '#999'}`,
                    transition: 'all 0.2s',
                    cursor: onEditEvent ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.bgSecondary
                  }}
                >
                  <div style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.textPrimary,
                    marginBottom: '4px'
                  }}>
                    {event.title}
                  </div>
                  <div style={{
                    fontSize: fontSize.xs,
                    color: colors.textSecondary
                  }}>
                    {new Date(event.start_time).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                  {event.description && (
                    <div style={{
                      fontSize: fontSize.sm,
                      color: colors.textSecondary,
                      marginTop: '6px',
                      lineHeight: lineHeight.tight
                    }}>
                      {event.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
