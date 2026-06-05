// Handles the task panel on the calendar page

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { usePlatform } from '../hooks/usePlatform'
import { fetchUserTasks, createUserTask, completeUserTask, updateUserTask, deleteUserTask } from '../lib/taskService'
import type { Task } from '../lib/taskService'
import { TaskForm } from './TaskForm'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontSize, fontWeight } from '../styles/typography'
import { supabase } from '../lib/supabase'
import { NewButton } from './ui/IconButtons'

// Export Task type for drag-drop handling
export type { Task } from '../lib/taskService'

interface TodoListProps {
  hideHeader?: boolean
}

export function TodoList({ hideHeader = false }: TodoListProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(false) // Desktop-scaled mobile fonts
  const { aspects } = useAspects()
  const [tasks, setTasks] = useState<Task[]>([])
  const [completedTodayTasks, setCompletedTodayTasks] = useState<Task[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  useEffect(() => {
    loadTasks()
  }, [user, session])

  // Real-time subscription for task updates
  useEffect(() => {
    if (!user) return

    // Listen for agent-initiated data changes
    const handleAgentChange = () => loadTasks()
    window.addEventListener('agent-data-changed', handleAgentChange)

    const channel = supabase
      .channel(`tasks-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Reload tasks on any change
          loadTasks()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('agent-data-changed', handleAgentChange)
      supabase.removeChannel(channel)
    }
  }, [user, session])

  const loadTasks = async () => {
    if (!user || !session) return
    setLoading(true)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [pendingResult, completedResult] = await Promise.all([
      fetchUserTasks(user, session.access_token, { status: 'pending' }),
      fetchUserTasks(user, session.access_token, { status: 'completed', completed_after: todayStart.toISOString() })
    ])

    setTasks(pendingResult.tasks || [])
    setCompletedTodayTasks(completedResult.tasks || [])
    setLoading(false)
  }

  const handleCreateTask = async (taskData: Partial<Task>) => {
    if (!user || !session) return
    await createUserTask(user, session.access_token, {
      title: taskData.title!,
      description: taskData.description,
      aspect: taskData.aspect,
      due_date: taskData.due_date,
      priority: taskData.priority,
      status: 'pending'
    })
    await loadTasks()
  }

  const handleCompleteTask = async (taskId: string) => {
    if (!user || !session) return
    await completeUserTask(user, session.access_token, taskId)
    await loadTasks()
  }

  const handleUncompleteTask = async (taskId: string) => {
    if (!user || !session) return
    await updateUserTask(user, session.access_token, taskId, { status: 'pending', completed_at: null as any })
    await loadTasks()
  }

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!user || !session || !editingTask) return

    await updateUserTask(user, session.access_token, editingTask.id, {
      title: taskData.title,
      description: taskData.description,
      aspect: taskData.aspect,
      due_date: taskData.due_date,
      priority: taskData.priority
    })
    await loadTasks()
    setEditingTask(null)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!user || !session) return
    await deleteUserTask(user, session.access_token, taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const getTaskColor = (task: Task): string => {
    // First try aspect_color from task
    if (task.aspect_color) {
      return task.aspect_color
    }

    // Then try to find aspect by name or id
    const aspect = aspects.find(a =>
      a.id === task.aspect_id ||
      a.name === task.aspect_name ||
      a.name === task.aspect
    )

    if (aspect?.color) {
      return aspect.color
    }

    // Default color
    return '#999'
  }


  return (
    <div style={{
      height: '100%',
      background: colors.bgSecondary,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header - Mobile-style */}
      {!hideHeader && (
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{
              ...typography.headingLg,
              fontWeight: fontWeight.bold,
              margin: 0,
              color: colors.textPrimary
            }}>
              Tasks
            </h3>
            <span style={{
              ...typography.labelMd,
              color: colors.textTertiary
            }}>
              {tasks.length} pending{completedTodayTasks.length > 0 ? `, ${completedTodayTasks.length} done today` : ''}
            </span>
          </div>
          <NewButton
            onClick={() => setIsFormOpen(true)}
            title="New task"
          />
        </div>
      )}

      {/* Add button when header is hidden */}
      {hideHeader && (
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
            {tasks.length} pending{completedTodayTasks.length > 0 ? `, ${completedTodayTasks.length} done today` : ''}
          </span>
          <NewButton
            onClick={() => setIsFormOpen(true)}
            title="New task"
                      />
        </div>
      )}

      {/* Tasks */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'clamp(8px, 1.5vh, 12px) clamp(8px, 2vw, 16px)',
        paddingBottom: 'clamp(8px, 1.5vh, 12px)'
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: colors.textSecondary,
            fontSize: fontSize.xs
          }}>
            Loading tasks...
          </div>
        ) : tasks.length === 0 && completedTodayTasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: colors.textTertiary,
            fontSize: fontSize.xs
          }}>
            No pending tasks
          </div>
        ) : (
          <>
            {/* Pending tasks */}
            {tasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {tasks.map(task => {
                  const taskColor = getTaskColor(task)
                  return (
                    <div
                      key={task.id}
                      draggable={!isMobile}
                      onDragStart={(e) => {
                        if (isMobile) return
                        e.dataTransfer.setData('application/glyde-task', JSON.stringify(task))
                        e.dataTransfer.effectAllowed = 'copy'
                        e.currentTarget.style.opacity = '0.5'
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1'
                      }}
                      style={{
                        padding: isMobile ? '10px 12px' : '6px 8px',
                        background: hexToRgba(taskColor, 0.15),
                        borderRadius: '3px',
                        border: 'none',
                        borderLeft: `2px solid ${taskColor}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: isMobile ? '10px' : '7px',
                        transition: 'all 0.15s',
                        cursor: isMobile ? 'pointer' : 'grab',
                        minHeight: isMobile ? '56px' : 'auto'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = hexToRgba(taskColor, 0.25)
                        if (!isMobile) {
                          const deleteBtn = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement
                          if (deleteBtn) deleteBtn.style.opacity = '0.5'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = hexToRgba(taskColor, 0.15)
                        if (!isMobile) {
                          const deleteBtn = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement
                          if (deleteBtn) { deleteBtn.style.opacity = '0'; deleteBtn.style.color = colors.textTertiary }
                        }
                      }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (target.tagName !== 'INPUT' && !target.closest('[data-delete-btn]')) {
                          setEditingTask(task)
                        }
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: isMobile ? '44px' : 'auto',
                        minHeight: isMobile ? '44px' : 'auto',
                        margin: isMobile ? '-10px -6px -10px -10px' : 0,
                        flexShrink: 0
                      }}>
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            e.stopPropagation()
                            handleCompleteTask(task.id)
                          }}
                          style={{
                            width: isMobile ? '20px' : '13px',
                            height: isMobile ? '20px' : '13px',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: isMobile ? fontSize.sm : fontSize.xs,
                          fontWeight: fontWeight.medium,
                          color: colors.textPrimary,
                          marginBottom: task.due_date || task.priority ? '2px' : 0
                        }}>
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {task.due_date && (
                            <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                          {task.priority && task.priority !== 'low' && (
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 4px',
                              borderRadius: '2px',
                              background: task.priority === 'urgent' ? '#fee' : task.priority === 'high' ? '#fef0e6' : '#fff9e6',
                              color: task.priority === 'urgent' ? '#c00' : task.priority === 'high' ? '#c60' : '#880',
                              fontWeight: fontWeight.medium
                            }}>
                              {task.priority}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        data-delete-btn
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: colors.textTertiary,
                          padding: isMobile ? '8px' : '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          opacity: isMobile ? 0.5 : 0,
                          transition: 'opacity 0.15s, color 0.15s',
                          minWidth: isMobile ? '44px' : 'auto',
                          minHeight: isMobile ? '44px' : 'auto',
                          margin: isMobile ? '-8px -8px -8px 0' : 0
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = colors.error }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = isMobile ? '0.5' : '0'
                          e.currentTarget.style.color = colors.textTertiary
                        }}
                        title="Delete task"
                      >
                        <svg width={isMobile ? '16' : '12'} height={isMobile ? '16' : '12'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Completed today */}
            {completedTodayTasks.length > 0 && (
              <>
                <div style={{
                  fontSize: '10px',
                  fontWeight: fontWeight.semibold,
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: tasks.length > 0 ? '12px 0 6px' : '0 0 6px'
                }}>
                  Completed today
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {completedTodayTasks.map(task => {
                    const taskColor = getTaskColor(task)
                    return (
                      <div
                        key={task.id}
                        style={{
                          padding: isMobile ? '10px 12px' : '6px 8px',
                          background: hexToRgba(taskColor, 0.08),
                          borderRadius: '3px',
                          border: 'none',
                          borderLeft: `2px solid ${hexToRgba(taskColor, 0.4)}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobile ? '10px' : '7px',
                          transition: 'all 0.15s',
                          cursor: 'pointer',
                          opacity: 0.7
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          if (target.tagName !== 'INPUT') {
                            setEditingTask(task)
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: isMobile ? '44px' : 'auto',
                          minHeight: isMobile ? '44px' : 'auto',
                          margin: isMobile ? '-10px -6px -10px -10px' : 0,
                          flexShrink: 0
                        }}>
                          <input
                            type="checkbox"
                            checked
                            onChange={(e) => {
                              e.stopPropagation()
                              handleUncompleteTask(task.id)
                            }}
                            style={{
                              width: isMobile ? '20px' : '13px',
                              height: isMobile ? '20px' : '13px',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: isMobile ? fontSize.sm : fontSize.xs,
                            fontWeight: fontWeight.medium,
                            color: colors.textTertiary,
                            textDecoration: 'line-through'
                          }}>
                            {task.title}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Task Creation Form */}
      <TaskForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleCreateTask}
      />

      {/* Task Edit Form */}
      <TaskForm
        task={editingTask || undefined}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleUpdateTask}
      />
    </div>
  )
}

