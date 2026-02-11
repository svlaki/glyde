// Handles the task panel on the calendar page

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useAspects } from '../lib/aspectContext'
import { fetchUserTasks, createUserTask, completeUserTask, updateUserTask } from '../lib/taskService'
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
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const typography = getTypography(false) // Desktop-scaled mobile fonts
  const { aspects } = useAspects()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  useEffect(() => {
    loadTasks()
  }, [user, session])

  // Real-time subscription for task updates
  useEffect(() => {
    if (!user) return

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
        (payload) => {
          console.log('[TodoList] Real-time task change:', payload.eventType)
          // Reload tasks on any change
          loadTasks()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[TodoList] Subscribed to real-time task updates')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, session])

  const loadTasks = async () => {
    if (!user || !session) return
    setLoading(true)
    const { tasks: userTasks } = await fetchUserTasks(user, session.access_token, { status: 'pending' })
    setTasks(userTasks || [])
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
              {tasks.length} pending
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
            {tasks.length} pending
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
        ) : tasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: colors.textTertiary,
            fontSize: fontSize.xs
          }}>
            No pending tasks
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {tasks.map(task => {
              const taskColor = getTaskColor(task)
              return (
                <div
                  key={task.id}
                  draggable={true}
                  onDragStart={(e) => {
                    // Store task data for calendar drop
                    e.dataTransfer.setData('application/glyde-task', JSON.stringify(task))
                    e.dataTransfer.effectAllowed = 'copy'
                    // Add visual feedback
                    e.currentTarget.style.opacity = '0.5'
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                  style={{
                    padding: '6px 8px',
                    background: hexToRgba(taskColor, 0.15),
                    borderRadius: '3px',
                    border: 'none',
                    borderLeft: `2px solid ${taskColor}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '7px',
                    transition: 'all 0.15s',
                    cursor: 'grab'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hexToRgba(taskColor, 0.25)
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hexToRgba(taskColor, 0.15)
                  }}
                  onClick={(e) => {
                    // Don't open modal if clicking checkbox
                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                      setEditingTask(task)
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      e.stopPropagation()
                      handleCompleteTask(task.id)
                    }}
                    style={{
                      width: '13px',
                      height: '13px',
                      cursor: 'pointer',
                      marginTop: '1px',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: fontSize.xs,
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
                </div>
              )
            })}
          </div>
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

