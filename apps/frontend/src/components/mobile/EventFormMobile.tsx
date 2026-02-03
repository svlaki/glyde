import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useAuth } from '../../lib/authContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { useCategories } from '../../lib/categoryContext'
import { createUserCategory, Category } from '../../lib/categoryService'
import { CalendarEvent, createRecurringEvent } from '../../lib/calendarService'
import { buildRRuleFromForm, getNextOccurrences } from '../../lib/recurrenceUtils'
import { AspectForm } from '../AspectForm'
import { getColors } from '../../styles/colors'
import { DatePickerMobile } from './DatePickerMobile'
import { TimePickerSlider } from './TimePickerSlider'

// Convert Date to picker value
const dateToPickerValue = (date: Date) => {
  let hour = date.getHours()
  const minute = date.getMinutes()
  const period = hour >= 12 ? 'PM' : 'AM'
  if (hour === 0) hour = 12
  else if (hour > 12) hour = hour - 12
  return {
    hour: String(hour),
    minute: String(minute).padStart(2, '0'),
    period
  }
}

// Convert picker value to Date (preserving the date part)
const pickerValueToDate = (pickerValue: { hour: string; minute: string; period: string }, baseDate: Date) => {
  let hour = parseInt(pickerValue.hour)
  const minute = parseInt(pickerValue.minute)
  if (pickerValue.period === 'AM') {
    if (hour === 12) hour = 0
  } else {
    if (hour !== 12) hour = hour + 12
  }
  const newDate = new Date(baseDate)
  newDate.setHours(hour, minute, 0, 0)
  return newDate
}

interface EventFormMobileProps {
  event?: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onSave: (event: Partial<CalendarEvent>) => Promise<void>
  onDelete?: () => Promise<void>
}

export function EventFormMobile({ event, isOpen, onClose, onSave, onDelete }: EventFormMobileProps) {
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

  // Picker states
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [startTimeValue, setStartTimeValue] = useState(() => dateToPickerValue(new Date()))
  const [endTimeValue, setEndTimeValue] = useState(() => dateToPickerValue(new Date()))

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

      if (event.start_time) {
        setStartDate(new Date(event.start_time))
      }
      if (event.end_time) {
        setEndDate(new Date(event.end_time))
      }
    } else {
      setTitle('')
      setLocation('')
      setDescription('')
      setCategory('')

      const now = new Date()
      const roundedStart = new Date(now)
      roundedStart.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
      setStartDate(roundedStart)

      const roundedEnd = new Date(roundedStart)
      roundedEnd.setHours(roundedEnd.getHours() + 1)
      setEndDate(roundedEnd)
    }

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

  // Sync picker values with dates
  useEffect(() => {
    setStartTimeValue(dateToPickerValue(startDate))
  }, [startDate])

  useEffect(() => {
    setEndTimeValue(dateToPickerValue(endDate))
  }, [endDate])

  useEffect(() => {
    if (!isRecurring || !startDate) {
      setRecurrencePreview([])
      return
    }
    try {
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

  // Format helpers
  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  const formatTime = (date: Date): string => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim()) return
    if (!location.trim()) return

    setLoading(true)
    try {
      if (endDate <= startDate) {
        alert('End time must be after start time.')
        setLoading(false)
        return
      }

      const startISO = startDate.toISOString()
      const endISO = endDate.toISOString()

      if (isRecurring && !event?.id && user) {
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

        await onSave({
          ...(createdEvent?.id ? { id: createdEvent.id } : {}),
          title: title.trim(),
          location: location.trim(),
          description: description.trim() || undefined,
          category: category || undefined,
          start_time: startISO,
          end_time: endISO
        })
      } else {
        await onSave({
          ...(event?.id ? { id: event.id } : {}),
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

  const fieldStyle = {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    background: colors.bgPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    color: colors.textPrimary,
    cursor: 'pointer',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 1100
            }}
          />
          <Dialog.Content
            onOpenAutoFocus={event?.id ? (e) => e.preventDefault() : undefined}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 40px)',
              maxWidth: '400px',
              height: '60vh',
              background: colors.bgSecondary,
              borderRadius: '16px',
              zIndex: 1101,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
              outline: 'none'
            }}
          >
            {/* Header with Title Input */}
            <div style={{
              padding: '16px',
              borderBottom: `1px solid ${colors.border}`,
              flexShrink: 0
            }}>
              <Dialog.Title asChild>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Event title"
                  style={{
                    width: '100%',
                    padding: '0',
                    fontSize: '20px',
                    fontWeight: '600',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: colors.textPrimary
                  }}
                />
              </Dialog.Title>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0
              }}
            >
              {/* Location */}
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Location *
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    background: colors.bgPrimary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textPrimary,
                    minHeight: '44px'
                  }}
                />
              </div>

              {/* Date Selection */}
              <div
                onClick={() => setShowDatePicker(true)}
                style={{
                  ...fieldStyle,
                  justifyContent: 'flex-start',
                  gap: '8px'
                }}
              >
{formatDate(startDate)}
              </div>

              {/* Time: Start → End */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    onClick={() => {
                      setShowStartTimePicker(!showStartTimePicker)
                      setShowEndTimePicker(false)
                    }}
                    style={{
                      ...fieldStyle,
                      flex: 1,
                      background: showStartTimePicker ? colors.bgHover : colors.bgPrimary
                    }}
                  >
                    {formatTime(startDate)}
                  </div>
                  <span style={{
                    color: colors.textSecondary,
                    fontSize: '18px',
                    flexShrink: 0
                  }}>→</span>
                  <div
                    onClick={() => {
                      setShowEndTimePicker(!showEndTimePicker)
                      setShowStartTimePicker(false)
                    }}
                    style={{
                      ...fieldStyle,
                      flex: 1,
                      background: showEndTimePicker ? colors.bgHover : colors.bgPrimary
                    }}
                  >
                    {formatTime(endDate)}
                  </div>
                </div>

                {/* Inline Start Time Picker */}
                {showStartTimePicker && (
                  <div style={{ marginTop: '8px' }}>
                    <TimePickerSlider
                      value={startTimeValue}
                      onChange={(val) => {
                        setStartTimeValue(val)
                        setStartDate(pickerValueToDate(val, startDate))
                      }}
                      height={150}
                      itemHeight={36}
                      backgroundColor={colors.bgPrimary}
                      borderColor={colors.border}
                      textColor={colors.textSecondary}
                      selectedTextColor={colors.textPrimary}
                    />
                  </div>
                )}

                {/* Inline End Time Picker */}
                {showEndTimePicker && (
                  <div style={{ marginTop: '8px' }}>
                    <TimePickerSlider
                      value={endTimeValue}
                      onChange={(val) => {
                        setEndTimeValue(val)
                        setEndDate(pickerValueToDate(val, endDate))
                      }}
                      height={150}
                      itemHeight={36}
                      backgroundColor={colors.bgPrimary}
                      borderColor={colors.border}
                      textColor={colors.textSecondary}
                      selectedTextColor={colors.textPrimary}
                    />
                  </div>
                )}
              </div>

              {/* Aspect */}
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Aspect
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      background: colors.bgPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: category ? colors.textPrimary : colors.textSecondary,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {category ? (
                      <>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: getCategoryColor(category),
                          flexShrink: 0
                        }} />
                        {category}
                      </>
                    ) : 'Select category...'}
                  </button>

                  {showCategoryDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      zIndex: 10,
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      <div
                        onClick={() => {
                          setCategory('')
                          setShowCategoryDropdown(false)
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: colors.textSecondary,
                          borderBottom: `1px solid ${colors.border}`
                        }}
                      >
                        None
                      </div>
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setCategory(cat.name)
                            setShowCategoryDropdown(false)
                          }}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '14px',
                            color: colors.textPrimary,
                            background: category === cat.name ? colors.bgHover : 'transparent'
                          }}
                        >
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: cat.color,
                            flexShrink: 0
                          }} />
                          {cat.name}
                        </div>
                      ))}
                      <div
                        onClick={() => {
                          setIsAspectFormOpen(true)
                          setShowCategoryDropdown(false)
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: colors.textPrimary,
                          fontWeight: '500',
                          borderTop: `1px solid ${colors.border}`
                        }}
                      >
                        + New Aspect
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  marginBottom: '4px',
                  display: 'block'
                }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    background: colors.bgPrimary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textPrimary,
                    resize: 'none',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Recurrence - only for new events */}
              {!event?.id && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: colors.textPrimary }}
                    />
                    <span style={{ fontSize: '14px', color: colors.textPrimary }}>Repeat</span>
                  </label>

                  {isRecurring && (
                    <select
                      value={recurrencePattern}
                      onChange={(e) => setRecurrencePattern(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                      style={{
                        padding: '8px 12px',
                        fontSize: '14px',
                        background: colors.bgPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        color: colors.textPrimary,
                        flex: 1
                      }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  )}
                </div>
              )}
            </form>

            {/* Footer with Save Button */}
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${colors.border}`,
              background: colors.bgSecondary,
              display: 'flex',
              gap: '12px',
              flexShrink: 0,
              justifyContent: event?.id ? 'space-between' : 'flex-end'
            }}>
              {event?.id && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  style={{
                    padding: '10px 14px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1.5px solid #ef4444',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    minHeight: '40px',
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  Delete
                </button>
              )}
              <button
                type="submit"
                onClick={() => handleSubmit()}
                disabled={loading || !title.trim() || !location.trim()}
                style={{
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (loading || !title.trim() || !location.trim()) ? 'not-allowed' : 'pointer',
                  minHeight: '40px',
                  opacity: (loading || !title.trim() || !location.trim()) ? 0.5 : 1
                }}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Date/Time Pickers */}
      <DatePickerMobile
        value={startDate}
        onChange={(newDate) => {
          // Update both start and end to same date (preserving times)
          const newStart = new Date(startDate)
          newStart.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
          setStartDate(newStart)

          const newEnd = new Date(endDate)
          newEnd.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
          setEndDate(newEnd)
        }}
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Aspect Form Modal */}
      {isAspectFormOpen && (
        <AspectForm
          isOpen={isAspectFormOpen}
          onClose={() => setIsAspectFormOpen(false)}
          onSave={handleCreateAspect}
        />
      )}
    </>
  )
}
