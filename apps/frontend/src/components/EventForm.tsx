import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, Category } from '../lib/categoryService'
import { CalendarEvent, createRecurringEvent } from '../lib/calendarService'
import { buildRRuleFromForm, getNextOccurrences } from '../lib/recurrenceUtils'
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
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [isAspectFormOpen, setIsAspectFormOpen] = useState(false)

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly')
  const [interval, setInterval] = useState(1)
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(['MO'])
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [endType, setEndType] = useState<'never' | 'after' | 'until'>('never')
  const [count, setCount] = useState(10)
  const [untilDate, setUntilDate] = useState('')
  const [recurrencePreview, setRecurrencePreview] = useState<Date[]>([])

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setLocation(event.location || '')
      setDescription(event.description || '')
      setCategory(event.category || '')

      // Set dates from event
      if (event.start_time) {
        setStartDate(new Date(event.start_time))
      } else {
        setStartDate(new Date())
      }

      if (event.end_time) {
        setEndDate(new Date(event.end_time))
      } else {
        const defaultEnd = new Date()
        defaultEnd.setHours(defaultEnd.getHours() + 1)
        setEndDate(defaultEnd)
      }
    } else {
      // Reset for new event
      setTitle('')
      setLocation('')
      setDescription('')
      setCategory('')

      // Default to current time rounded to next 30 min
      const now = new Date()
      const roundedStart = new Date(now)
      roundedStart.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
      setStartDate(roundedStart)

      // Default end time 1 hour after start
      const roundedEnd = new Date(roundedStart)
      roundedEnd.setHours(roundedEnd.getHours() + 1)
      setEndDate(roundedEnd)
    }
    // Reset recurrence state
    setIsRecurring(false)
    setRecurrencePattern('weekly')
    setInterval(1)
    setDaysOfWeek(['MO'])
    setDayOfMonth(1)
    setEndType('never')
    setCount(10)
    setUntilDate('')
    setRecurrencePreview([])
    setShowCategoryDropdown(false)
  }, [event, isOpen])

  // Update recurrence preview when settings change
  useEffect(() => {
    if (!isRecurring || !startDate) {
      setRecurrencePreview([])
      return
    }
    try {
      if (isNaN(startDate.getTime())) {
        setRecurrencePreview([])
        return
      }
      const rrule = buildRRuleFromForm({
        pattern: recurrencePattern,
        interval,
        daysOfWeek: recurrencePattern === 'weekly' ? daysOfWeek : [],
        dayOfMonth: recurrencePattern === 'monthly' ? dayOfMonth : 1,
        endType,
        count: endType === 'after' ? count : undefined,
        untilDate: endType === 'until' && untilDate ? new Date(untilDate) : undefined
      })
      const occurrences = getNextOccurrences(rrule, startDate, 3)
      setRecurrencePreview(occurrences)
    } catch (err) {
      console.error('Error updating recurrence preview:', err)
      setRecurrencePreview([])
    }
  }, [isRecurring, startDate, recurrencePattern, interval, daysOfWeek, dayOfMonth, endType, count, untilDate])

  // Helper functions for date/time inputs
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const formatTimeForInput = (date: Date): string => {
    return date.toTimeString().slice(0, 5)
  }

  const handleDateChange = (dateStr: string, isStart: boolean) => {
    const currentDate = isStart ? startDate : endDate
    const [year, month, day] = dateStr.split('-').map(Number)
    const newDate = new Date(currentDate)
    newDate.setFullYear(year, month - 1, day)

    if (isStart) {
      setStartDate(newDate)
      if (endDate <= newDate) {
        const newEnd = new Date(newDate)
        newEnd.setHours(newEnd.getHours() + 1)
        setEndDate(newEnd)
      }
    } else {
      setEndDate(newDate)
    }
  }

  const handleTimeChange = (timeStr: string, isStart: boolean) => {
    const currentDate = isStart ? startDate : endDate
    const [hours, minutes] = timeStr.split(':').map(Number)
    const newDate = new Date(currentDate)
    newDate.setHours(hours, minutes, 0, 0)

    if (isStart) {
      setStartDate(newDate)
      if (endDate <= newDate) {
        const newEnd = new Date(newDate)
        newEnd.setHours(newEnd.getHours() + 1)
        setEndDate(newEnd)
      }
    } else {
      setEndDate(newDate)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (!location.trim()) return
    if (!startDate || !endDate) return

    setLoading(true)
    try {
      // Validate dates
      if (endDate <= startDate) {
        alert('End time must be after start time.')
        setLoading(false)
        return
      }

      // Convert to ISO format
      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      // Handle recurring event creation
      if (isRecurring && !event?.id && user) {
        // Build RRULE
        const rrule = buildRRuleFromForm({
          pattern: recurrencePattern,
          interval,
          daysOfWeek: recurrencePattern === 'weekly' ? daysOfWeek : [],
          dayOfMonth: recurrencePattern === 'monthly' ? dayOfMonth : 1,
          endType,
          count: endType === 'after' ? count : undefined,
          untilDate: endType === 'until' && untilDate ? new Date(untilDate) : undefined
        })

        const { event: createdEvent, error } = await createRecurringEvent(
          user,
          title.trim(),
          startISO,
          rrule,
          category || 'Personal',
          description.trim() || undefined,
          location.trim(),
          endType === 'until' && untilDate ? new Date(untilDate).toISOString() : undefined,
          session?.access_token
        )

        if (error) {
          alert('Failed to create recurring event: ' + error)
          setLoading(false)
          return
        }

        // Call onSave with the created event to trigger a refresh
        await onSave({
          id: createdEvent?.id,
          title: title.trim(),
          location: location.trim(),
          description: description.trim() || undefined,
          category: category || undefined,
          start_time: startISO,
          end_time: endISO
        })
      } else {
        // Regular event
        await onSave({
          id: event?.id,
          title: title.trim(),
          location: location.trim(),
          description: description.trim() || undefined,
          category: category || undefined,
          start_time: startISO,
          end_time: endISO
        })
      }
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

  const titleInput = (
    <input
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      required
      placeholder="Event title"
      style={{
        width: '100%',
        padding: '0',
        fontSize: '20px',
        fontWeight: '600',
        background: 'transparent',
        color: colors.textPrimary,
        border: 'none',
        outline: 'none'
      }}
    />
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      headerContent={titleInput}
      maxWidth="500px"
      preventAutoFocus={!!event?.id}
    >
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }}>
        {/* Form Body */}
        <div style={{
          padding: 'clamp(12px, 2.5vh, 20px) clamp(12px, 3vw, 20px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(12px, 2vh, 16px)',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0
        }}>
          {/* Location */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Location *
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="Add location"
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

          {/* Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Date
            </label>
            <input
              type="date"
              value={formatDateForInput(startDate)}
              onChange={(e) => handleDateChange(e.target.value, true)}
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

          {/* Time: Start → End */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Time
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="time"
                value={formatTimeForInput(startDate)}
                onChange={(e) => handleTimeChange(e.target.value, true)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  fontSize: '14px',
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px'
                }}
              />
              <span style={{ color: colors.textSecondary, fontSize: '18px', flexShrink: 0 }}>→</span>
              <input
                type="time"
                value={formatTimeForInput(endDate)}
                onChange={(e) => handleTimeChange(e.target.value, false)}
                style={{
                  flex: 1,
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

        {/* Recurrence Toggle - Only for new events */}
        {!event?.id && (
          <div style={{
            padding: '16px',
            background: colors.bgPrimary,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`
          }}>
            {/* Toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              marginBottom: isRecurring ? '16px' : '0'
            }}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>
                Make this a recurring event
              </span>
            </label>

            {/* Recurrence Options */}
            {isRecurring && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Pattern */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '13px', color: colors.textSecondary, minWidth: '80px' }}>Repeat:</label>
                  <select
                    value={recurrencePattern}
                    onChange={(e) => setRecurrencePattern(e.target.value as any)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      flex: 1,
                      minWidth: '120px'
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                {/* Interval */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '13px', color: colors.textSecondary, minWidth: '80px' }}>Every:</label>
                  <input
                    type="number"
                    min="1"
                    value={interval}
                    onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: '60px',
                      padding: '8px',
                      fontSize: '14px',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                    {recurrencePattern === 'daily' ? 'day(s)' : recurrencePattern === 'weekly' ? 'week(s)' : recurrencePattern === 'monthly' ? 'month(s)' : 'year(s)'}
                  </span>
                </div>

                {/* Days of Week (for weekly) */}
                {recurrencePattern === 'weekly' && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {[
                      { label: 'M', value: 'MO' },
                      { label: 'T', value: 'TU' },
                      { label: 'W', value: 'WE' },
                      { label: 'T', value: 'TH' },
                      { label: 'F', value: 'FR' },
                      { label: 'S', value: 'SA' },
                      { label: 'S', value: 'SU' }
                    ].map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          if (daysOfWeek.includes(day.value)) {
                            if (daysOfWeek.length > 1) {
                              setDaysOfWeek(daysOfWeek.filter(d => d !== day.value))
                            }
                          } else {
                            setDaysOfWeek([...daysOfWeek, day.value])
                          }
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: `1px solid ${daysOfWeek.includes(day.value) ? colors.textPrimary : colors.border}`,
                          background: daysOfWeek.includes(day.value) ? colors.textPrimary : 'transparent',
                          color: daysOfWeek.includes(day.value) ? colors.bgPrimary : colors.textSecondary,
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Day of Month (for monthly) */}
                {recurrencePattern === 'monthly' && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '13px', color: colors.textSecondary, minWidth: '80px' }}>On day:</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                      style={{
                        width: '60px',
                        padding: '8px',
                        fontSize: '14px',
                        background: colors.bgSecondary,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                )}

                {/* End Condition */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '13px', color: colors.textSecondary, minWidth: '80px' }}>Ends:</label>
                  <select
                    value={endType}
                    onChange={(e) => setEndType(e.target.value as any)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px'
                    }}
                  >
                    <option value="never">Never</option>
                    <option value="after">After</option>
                    <option value="until">On date</option>
                  </select>

                  {endType === 'after' && (
                    <>
                      <input
                        type="number"
                        min="1"
                        value={count}
                        onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: '60px',
                          padding: '8px',
                          fontSize: '14px',
                          background: colors.bgSecondary,
                          color: colors.textPrimary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          textAlign: 'center'
                        }}
                      />
                      <span style={{ fontSize: '13px', color: colors.textSecondary }}>occurrences</span>
                    </>
                  )}

                  {endType === 'until' && (
                    <input
                      type="date"
                      value={untilDate}
                      onChange={(e) => setUntilDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '14px',
                        background: colors.bgSecondary,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px'
                      }}
                    />
                  )}
                </div>

                {/* Preview */}
                {recurrencePreview.length > 0 && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: colors.bgSecondary,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: colors.textSecondary
                  }}>
                    <span style={{ fontWeight: '500' }}>Next occurrences:</span>
                    <div style={{ marginTop: '4px' }}>
                      {recurrencePreview.map((date, idx) => (
                        <div key={idx}>
                          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

            <button
              type="submit"
              disabled={loading || !title.trim() || !location.trim()}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                marginLeft: 'auto',
                cursor: (loading || !title.trim() || !location.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !title.trim() || !location.trim()) ? 0.5 : 1
              }}
            >
              {loading ? 'Saving...' : event?.id ? 'Save' : 'Create'}
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
