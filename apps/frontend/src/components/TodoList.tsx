// Handles the task panel on the calendar page

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { fetchUserTasks, createUserTask, completeUserTask, updateUserTask, Task } from '../lib/taskService'
import { TaskForm } from './TaskForm'
import { getColors, hexToRgba } from '../styles/colors'

interface TodoListProps {
  hideHeader?: boolean
}

export function TodoList({ hideHeader = false }: TodoListProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories } = useCategories()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  useEffect(() => {
    loadTasks()
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
      category: taskData.category,
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
      category: taskData.category,
      due_date: taskData.due_date,
      priority: taskData.priority
    })
    await loadTasks()
    setEditingTask(null)
  }

  const getTaskColor = (task: Task): string => {
    // First try category_color from task
    if (task.category_color) {
      return task.category_color
    }

    // Then try to find category by name or id
    const category = categories.find(c =>
      c.id === task.category_id ||
      c.name === task.category_name ||
      c.name === task.category
    )

    if (category?.color) {
      return category.color
    }

    // Default color
    return '#999'
  }


  return (
    <div style={{
      height: '100%',
      background: colors.bgPrimary,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      {!hideHeader && (
        <div style={{
          padding: 'clamp(12px, 2.5vh, 20px) clamp(12px, 3vw, 20px) clamp(4px, 0.5vh, 5px)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              margin: 0,
              color: colors.textPrimary
            }}>
              Tasks
            </h3>
            <button
              onClick={() => {
                console.log('[TodoList] Opening task form')
                setIsFormOpen(true)
              }}
              className="btn btn-primary"
              style={{ padding: '5px 10px', fontSize: '16px' }}
            >
              +
            </button>
          </div>
          <div style={{
            fontSize: '13px',
            color: colors.textSecondary
          }}>
            {tasks.length} pending
          </div>
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
          <span style={{ fontSize: '13px', color: colors.textSecondary }}>
            {tasks.length} pending
          </span>
          <button
            onClick={() => {
              setIsFormOpen(true)
            }}
            className="btn btn-primary"
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
            New
        </button>
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
            fontSize: '12px'
          }}>
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: colors.textTertiary,
            fontSize: '12px'
          }}>
            No pending tasks
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map(task => {
              const taskColor = getTaskColor(task)
              return (
                <div
                  key={task.id}
                  style={{
                    padding: '10px 12px',
                    background: hexToRgba(taskColor, 0.15),
                    borderRadius: '3px',
                    border: 'none',
                    borderLeft: `3px solid ${taskColor}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    transition: 'all 0.15s',
                    cursor: 'pointer'
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
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      marginTop: '2px',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: colors.textPrimary,
                      marginBottom: task.due_date || task.priority ? '4px' : 0
                    }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {task.due_date && (
                        <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                          {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      {task.priority && task.priority !== 'low' && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: task.priority === 'urgent' ? '#fee' : task.priority === 'high' ? '#fef0e6' : '#fff9e6',
                          color: task.priority === 'urgent' ? '#c00' : task.priority === 'high' ? '#c60' : '#880',
                          fontWeight: '500'
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

