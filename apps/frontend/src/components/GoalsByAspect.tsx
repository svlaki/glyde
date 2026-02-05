import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserGoals, Goal } from '../lib/goalService'
import { fetchUserEvents, CalendarEvent } from '../lib/calendarService'
import { fetchUserTasks, Task } from '../lib/taskService'
import { Category } from '../lib/categoryService'
import { EmptyState } from './EmptyState'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight, lineHeight } from '../styles/typography'
import { EditButton, DeleteButton } from './ui/IconButtons'

interface GoalsByAspectProps {
  aspect: Category | null
  onEdit?: (() => void) | undefined
  onDelete?: (() => void) | undefined
}

export function GoalsByAspect({ aspect, onEdit, onDelete }: GoalsByAspectProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [goals, setGoals] = useState<Goal[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

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
          goal.category === aspect.name ||
          goal.category === aspect.id ||
          goal.category === aspect.id?.toString()
        )
        setGoals(filteredGoals)

        // Fetch events
        const { events: allEvents } = await fetchUserEvents(user, session.access_token)
        console.log('All events:', allEvents)
        console.log('Looking for aspect:', aspect)
        const filteredEvents = allEvents.filter(event => {
          const matches = event.category === aspect.name ||
                         event.category === aspect.id ||
                         event.category === aspect.id?.toString()
          if (matches) {
            console.log('Event matches:', event)
          }
          return matches
        })
        console.log('Filtered events:', filteredEvents)
        setEvents(filteredEvents)

        // Fetch tasks
        const { tasks: allTasks } = await fetchUserTasks(user, session.access_token, {})
        const filteredTasks = allTasks.filter(task =>
          task.category === aspect.name ||
          task.category === aspect.id ||
          task.category === aspect.id?.toString() ||
          task.category_name === aspect.name ||
          task.category_id === aspect.id ||
          task.category_id === aspect.id?.toString()
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
  const pastEvents = events.filter(event => isPastEvent(event))
  const activeTasks = tasks.filter(task => task.status !== 'completed')
  const completedTasks = tasks.filter(task => task.status === 'completed')
  const totalItems = events.length + tasks.length + goals.length

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Aspect Description */}
        {aspect.description && (
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
          {(onEdit || onDelete) && (
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
          <h4 style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Events ({currentEvents.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {currentEvents.map(event => (
              <div
                key={event.id}
                style={{
                  padding: '12px 16px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  borderLeft: `4px solid ${aspect.color || '#999'}`,
                  transition: 'all 0.2s'
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
        </div>
      )}

      {/* Tasks Section */}
      {activeTasks.length > 0 && (
        <div>
          <h4 style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Tasks ({activeTasks.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {activeTasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '12px 16px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  borderLeft: `4px solid ${aspect.color || '#999'}`,
                  transition: 'all 0.2s'
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
                  <div style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.textPrimary
                  }}>
                    {task.title}
                  </div>
                  {task.status && (
                    <span style={{
                      fontSize: fontSize.xs,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: task.status === 'completed' ? '#4ade80' :
                                 task.status === 'in_progress' ? '#fbbf24' : colors.bgTertiary,
                      color: task.status === 'completed' || task.status === 'in_progress' ? '#000' : colors.textSecondary,
                      fontWeight: fontWeight.medium
                    }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {task.due_date && (
                  <div style={{
                    fontSize: fontSize.xs,
                    color: colors.textSecondary
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
                    lineHeight: lineHeight.tight
                  }}>
                    {task.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals Section */}
      {goals.length > 0 && (
        <div>
          <h4 style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Goals ({goals.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {goals.map(goal => (
              <div
                key={goal.id}
                style={{
                  padding: '12px 16px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  borderLeft: `4px solid ${aspect.color || '#999'}`,
                  transition: 'all 0.2s'
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
        </div>
      )}

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div>
          <h4 style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Completed Tasks ({completedTasks.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {completedTasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '12px 16px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  borderLeft: `4px solid ${aspect.color || '#999'}`,
                  transition: 'all 0.2s'
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
                  <div style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.textPrimary
                  }}>
                    {task.title}
                  </div>
                  <span style={{
                    fontSize: fontSize.xs,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#4ade80',
                    color: '#000',
                    fontWeight: fontWeight.medium
                  }}>
                    completed
                  </span>
                </div>
                {task.due_date && (
                  <div style={{
                    fontSize: fontSize.xs,
                    color: colors.textSecondary
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
                    lineHeight: lineHeight.tight
                  }}>
                    {task.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Events Section */}
      {pastEvents.length > 0 && (
        <div>
          <h4 style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Past Events ({pastEvents.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {pastEvents.map(event => (
              <div
                key={event.id}
                style={{
                  padding: '12px 16px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  borderLeft: `4px solid ${aspect.color || '#999'}`,
                  transition: 'all 0.2s'
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
        </div>
      )}
    </div>
  )
}
