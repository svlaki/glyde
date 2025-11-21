import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserGoals, Goal } from '../lib/goalService'
import { fetchUserEvents, CalendarEvent } from '../lib/calendarService'
import { fetchUserTasks, Task } from '../lib/taskService'
import { Category } from '../lib/categoryService'
import { EmptyState } from './EmptyState'
import { getColors } from '../styles/colors'

interface GoalsByAspectProps {
  aspect: Category | null
}

export function GoalsByAspect({ aspect }: GoalsByAspectProps) {
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
        fontSize: '14px'
      }}>
        Loading...
      </div>
    )
  }

  const totalItems = events.length + tasks.length + goals.length

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Header */}
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
          {aspect.icon && <span style={{ fontSize: '24px' }}>{aspect.icon}</span>}
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.textPrimary,
              margin: '0 0 4px 0'
            }}>
              {aspect.name}
            </h3>
            <div style={{
              fontSize: '13px',
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
        </div>

        {/* Aspect Description */}
        {aspect.description && (
          <div style={{
            padding: '12px',
            background: colors.bgHover,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            fontSize: '13px',
            color: colors.textPrimary,
            lineHeight: '1.5'
          }}>
            {aspect.description}
          </div>
        )}
      </div>

      {/* No items message */}
      {totalItems === 0 && (
        <EmptyState
          title="No items yet"
          description={`No events, tasks, or goals found for the "${aspect.name}" aspect`}
        />
      )}

      {/* Events Section */}
      {events.length > 0 && (
        <div>
          <h4 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.textPrimary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Events ({events.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {events.map(event => (
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
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginBottom: '4px'
                }}>
                  {event.title}
                </div>
                <div style={{
                  fontSize: '12px',
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
                    fontSize: '13px',
                    color: colors.textSecondary,
                    marginTop: '6px',
                    lineHeight: '1.4'
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
      {tasks.length > 0 && (
        <div>
          <h4 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.textPrimary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Tasks ({tasks.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {tasks.map(task => (
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
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.textPrimary
                  }}>
                    {task.title}
                  </div>
                  {task.status && (
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: task.status === 'completed' ? '#4ade80' :
                                 task.status === 'in_progress' ? '#fbbf24' : colors.bgTertiary,
                      color: task.status === 'completed' || task.status === 'in_progress' ? '#000' : colors.textSecondary,
                      fontWeight: '500'
                    }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {task.due_date && (
                  <div style={{
                    fontSize: '12px',
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
                    fontSize: '13px',
                    color: colors.textSecondary,
                    marginTop: '6px',
                    lineHeight: '1.4'
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
            fontSize: '14px',
            fontWeight: '600',
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
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginBottom: '4px'
                }}>
                  {goal.title}
                </div>
                {goal.description && (
                  <div style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                    lineHeight: '1.4'
                  }}>
                    {goal.description}
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
