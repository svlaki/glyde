import { useState, useEffect } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, Category } from '../lib/categoryService'
import { useAuth } from '../lib/authContext'
import { Task } from '../lib/taskService'
import { AspectForm } from './AspectForm'
import { getColors } from '../styles/colors'
import { Modal } from './Modal'

interface TaskFormProps {
  task?: Task
  isOpen: boolean
  onClose: () => void
  onSave: (task: Partial<Task>) => Promise<void>
}

export function TaskForm({ task, isOpen, onClose, onSave }: TaskFormProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories, refreshCategories } = useCategories()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [loading, setLoading] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [isAspectFormOpen, setIsAspectFormOpen] = useState(false)

  console.log('[TaskForm] Render - isOpen:', isOpen, 'title:', title, 'task:', task)

  useEffect(() => {
    if (task) {
      console.log('[TaskForm] Populating fields with task:', task)
      setTitle(task.title || '')
      setDescription(task.description || '')
      // Handle different category field names
      setCategory(task.category_name || task.category || '')

      // Format existing due date as readable string
      if (task.due_date) {
        const dueDateTime = new Date(task.due_date)
        if (!isNaN(dueDateTime.getTime())) {
          setDueDate(formatDateTimeForInput(dueDateTime))
        } else {
          setDueDate(task.due_date)
        }
      } else {
        setDueDate('')
      }

      setPriority(task.priority || 'medium')
    } else {
      console.log('[TaskForm] Resetting fields (no task)')
      setTitle('')
      setDescription('')
      setCategory('')
      setDueDate('')
      setPriority('medium')
    }
    // Close dropdown when form opens/closes
    setShowCategoryDropdown(false)
  }, [task, isOpen])

  // Helper function to format date for input display
  const formatDateTimeForInput = (date: Date): string => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const month = months[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()
    const hours = date.getHours()
    const minutes = date.getMinutes()

    // Check if time is set (not midnight)
    if (hours === 0 && minutes === 0) {
      return `${month} ${day}, ${year}`
    }

    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')

    return `${month} ${day}, ${year} ${displayHours}:${displayMinutes} ${ampm}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      let dueDateISO: string | undefined = undefined

      // Parse and validate due date if provided
      if (dueDate && dueDate.trim()) {
        const parsedDate = new Date(dueDate)

        if (isNaN(parsedDate.getTime())) {
          alert('Invalid due date/time. Please use a format like "January 21, 2025" or "January 21, 2025 2:30 PM"')
          setLoading(false)
          return
        }

        dueDateISO = parsedDate.toISOString()
      }

      await onSave({
        id: task?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        due_date: dueDateISO,
        priority,
        status: 'pending'
      })
      onClose()
      setShowCategoryDropdown(false)
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Failed to save task. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAspect = async (aspectData: Partial<Category>) => {
    if (!user || !session) return

    try {
      await createUserCategory(user, aspectData as any, session.access_token)
      await refreshCategories()
      // Auto-select the newly created aspect
      if (aspectData.name) {
        setCategory(aspectData.name)
      }
      setIsAspectFormOpen(false)
      setShowCategoryDropdown(false)
    } catch (error) {
      console.error('Error creating aspect:', error)
      throw error
    }
  }

  const getCategoryColor = (categoryName: string): string => {
    const cat = categories.find(c => c.name === categoryName)
    return cat?.color || '#999'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Edit Task' : 'Create New Task'}
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
          {/* Title */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Call dentist, Buy groceries, Submit report"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Aspect */}
          <div style={{ position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Aspect
            </label>
            <div
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '42px'
              }}
            >
              {category ? (
                <>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: getCategoryColor(category),
                    flexShrink: 0
                  }} />
                  {categories.find(c => c.name === category)?.icon && (
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>
                      {categories.find(c => c.name === category)?.icon}
                    </span>
                  )}
                  <span>{category}</span>
                </>
              ) : (
                <span style={{ color: colors.textSecondary }}>Select aspect...</span>
              )}
            </div>

            {/* Dropdown */}
            {showCategoryDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  maxHeight: '250px',
                  overflowY: 'auto',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  background: colors.bgSecondary,
                  boxShadow: isDarkMode
                    ? '0 8px 24px rgba(0,0,0,0.4)'
                    : '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 1000
                }}
              >
                {/* None option */}
                <div
                  onClick={() => {
                    setCategory('')
                    setShowCategoryDropdown(false)
                  }}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: colors.textSecondary,
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  None
                </div>
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.name)
                      setShowCategoryDropdown(false)
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '14px',
                      color: colors.textPrimary,
                      transition: 'background 0.15s ease',
                      borderTop: `1px solid ${colors.borderLight}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: cat.color || '#999',
                      flexShrink: 0
                    }} />
                    {cat.icon && (
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{cat.icon}</span>
                    )}
                    <span>{cat.name}</span>
                  </div>
                ))}
                {/* Create new aspect button */}
                <div
                  onClick={() => {
                    setIsAspectFormOpen(true)
                    setShowCategoryDropdown(false)
                  }}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    color: isDarkMode ? '#f0f0f0' : '#000',
                    fontWeight: '500',
                    transition: 'background 0.15s ease',
                    borderTop: `2px solid ${colors.border}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>+</span>
                  <span>New Aspect</span>
                </div>
              </div>
            )}
          </div>

          {/* Priority and Due Date Row */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px'
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Due Date & Time
              </label>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="e.g., Jan 21, 2025 2:30 PM"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px'
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add any notes or details..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: `1px solid ${colors.border}`
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                cursor: (loading || !title.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !title.trim()) ? 0.5 : 1
              }}
            >
              {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>

      {/* Aspect Form Modal */}
      <AspectForm
        isOpen={isAspectFormOpen}
        onClose={() => setIsAspectFormOpen(false)}
        onSave={handleCreateAspect}
      />
    </Modal>
  )
}
