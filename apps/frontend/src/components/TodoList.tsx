import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { fetchUserTasks } from '../lib/taskService'

interface Task {
  id: string
  title: string
  status: string
  priority?: string
  due_date?: string
  category?: string
}

export function TodoList() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    async function loadTasks() {
      if (!user) return
      const { tasks: userTasks } = await fetchUserTasks(user, session?.access_token, { status: 'pending' })
      setTasks(userTasks || [])
    }
    loadTasks()
  }, [user, session])

  return (
    <div style={{
      height: '100%',
      background: isDarkMode ? '#1a1a1a' : '#fff',
      borderTop: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
        background: isDarkMode ? '#0a0a0a' : '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
          To-Do List ({tasks.length})
        </h3>
        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
          + Add Task
        </button>
      </div>

      {/* Tasks */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '15px 20px'
      }}>
        {tasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#999',
            fontSize: '13px'
          }}>
            No pending tasks.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tasks.map(task => (
              <div
                key={task.id}
                style={{
                  padding: '12px',
                  background: isDarkMode ? '#0a0a0a' : '#fafafa',
                  borderRadius: '6px',
                  border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDarkMode ? '#2a2a2a' : '#f0f0f0'
                  e.currentTarget.style.borderColor = isDarkMode ? '#3a3a3a' : '#d5d5d5'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDarkMode ? '#0a0a0a' : '#fafafa'
                  e.currentTarget.style.borderColor = isDarkMode ? '#2a2a2a' : '#e5e5e5'
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: isDarkMode ? '#fff' : '#000' }}>
                    {task.title}
                  </div>
                  {task.due_date && (
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {task.priority && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: task.priority === 'high' ? '#fee' : '#ffe',
                    color: task.priority === 'high' ? '#c00' : '#880'
                  }}>
                    {task.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
