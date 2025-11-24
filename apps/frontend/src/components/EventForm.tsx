import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, Category } from '../lib/categoryService'
import { CalendarEvent } from '../lib/eventService'
import { AspectForm } from './AspectForm'
import { getColors } from '../styles/colors'
import { Modal } from './Modal'

interface EventFormProps {
  event?: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onSave: (event: Partial<CalendarEvent>) => Promise<void>
  onDelete?: () => Promise<void>
}

export function EventForm({ event, isOpen, onClose, onSave, onDelete }: EventFormProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories, refreshCategories } = useCategories()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [isAspectFormOpen, setIsAspectFormOpen] = useState(false)

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setDescription(event.description || '')
      setCategory(event.category || '')

      // Format existing dates as readable strings
      if (event.start_time) {
        const startDate = new Date(event.start_time)
        setStartDateTime(formatDateTimeForInput(startDate))
      } else {
        setStartDateTime('')
      }

      if (event.end_time) {
        const endDate = new Date(event.end_time)
        setEndDateTime(formatDateTimeForInput(endDate))
      } else {
        setEndDateTime('')
      }
    } else {
      // Reset for new event
      setTitle('')
      setDescription('')
      setCategory('')

      // Default to current time rounded to next 30 min
      const now = new Date()
      const roundedStart = new Date(now)
      roundedStart.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
      setStartDateTime(formatDateTimeForInput(roundedStart))

      // Default end time 1 hour after start
      const roundedEnd = new Date(roundedStart)
      roundedEnd.setHours(roundedEnd.getHours() + 1)
      setEndDateTime(formatDateTimeForInput(roundedEnd))
    }
    setShowCategoryDropdown(false)
  }, [event, isOpen])

  // Helper function to format date for input display
  const formatDateTimeForInput = (date: Date): string => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const month = months[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')

    return `${month} ${day}, ${year} ${displayHours}:${displayMinutes} ${ampm}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (!startDateTime || !endDateTime) return

    setLoading(true)
    try {
      // Parse string dates to Date objects
      const startDate = new Date(startDateTime)
      const endDate = new Date(endDateTime)

      // Validate dates
      if (isNaN(startDate.getTime())) {
        alert('Invalid start date/time. Please use a format like "January 21, 2025 2:30 PM"')
        setLoading(false)
        return
      }

      if (isNaN(endDate.getTime())) {
        alert('Invalid end date/time. Please use a format like "January 21, 2025 3:30 PM"')
        setLoading(false)
        return
      }

      if (endDate <= startDate) {
        alert('End time must be after start time.')
        setLoading(false)
        return
      }

      // Convert to ISO format
      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      await onSave({
        id: event?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        start_time: startISO,
        end_time: endISO
      })
      onClose()
      setShowCategoryDropdown(false)
    } catch (error) {
      console.error('Error saving event:', error)
      alert('Failed to save event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !event?.id) return

    setLoading(true)
    try {
      await onDelete()
      onClose()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAspect = async (aspectData: Partial<Category>) => {
    if (!user || !session) return

    try {
      await createUserCategory(user, aspectData as any, session.access_token)
      await refreshCategories()
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
      title={event?.id ? 'Edit Event' : 'New Event'}
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
            Event Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., Team Meeting, Dentist Appointment"
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

        {/* Start Date & Time */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Start Date & Time *
          </label>
          <input
            type="text"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            required
            placeholder="e.g., January 21, 2025 2:30 PM"
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

        {/* End Date & Time */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            End Date & Time *
          </label>
          <input
            type="text"
            value={endDateTime}
            onChange={(e) => setEndDateTime(e.target.value)}
            required
            placeholder="e.g., January 21, 2025 3:30 PM"
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
          justifyContent: event?.id ? 'space-between' : 'flex-end',
          paddingTop: '16px',
          borderTop: `1px solid ${colors.border}`
        }}>
          {/* Delete button (only for existing events) */}
          {event?.id && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                background: 'transparent',
                color: '#ef4444',
                border: `1px solid #ef4444`,
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              Delete
            </button>
          )}

          <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
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
              disabled={loading || !title.trim() || !startDateTime || !endDateTime}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                cursor: (loading || !title.trim() || !startDateTime || !endDateTime) ? 'not-allowed' : 'pointer',
                opacity: (loading || !title.trim() || !startDateTime || !endDateTime) ? 0.5 : 1
              }}
            >
              {loading ? 'Saving...' : event?.id ? 'Update Event' : 'Create Event'}
            </button>
          </div>
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
