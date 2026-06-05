import { useState, useEffect, useRef } from 'react'
import Picker from 'react-mobile-picker'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { createUserAspect } from '../lib/aspectService'
import type { Aspect } from '../lib/aspectService'
import { useAuth } from '../lib/authContext'
import type { Task } from '../lib/taskService'
import { AspectForm } from './AspectForm'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { Modal } from './Modal'
import { DatePickerMobile } from './mobile/DatePickerMobile'
import { DatePickerWeb, TimeInputWeb } from './ui/date-time-picker-web'
import { usePlatform } from '../hooks/usePlatform'
import { SaveTextButton, DeleteTextButton } from './ui/IconButtons'

// Time picker options
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const PERIODS = ['AM', 'PM']

const dateToPickerValue = (date: Date) => {
  let hour = date.getHours()
  const minute = date.getMinutes()
  const period = hour >= 12 ? 'PM' : 'AM'
  if (hour === 0) hour = 12
  else if (hour > 12) hour = hour - 12
  return { hour: String(hour), minute: String(minute).padStart(2, '0'), period }
}

const pickerValueToDate = (val: { hour: string; minute: string; period: string }, baseDate: Date) => {
  let hour = parseInt(val.hour)
  const minute = parseInt(val.minute)
  if (val.period === 'AM' && hour === 12) hour = 0
  else if (val.period === 'PM' && hour !== 12) hour += 12
  const newDate = new Date(baseDate)
  newDate.setHours(hour, minute, 0, 0)
  return newDate
}

interface TaskFormProps {
  task?: Task
  isOpen: boolean
  onClose: () => void
  onSave: (task: Partial<Task>) => Promise<void>
  onDelete?: (() => Promise<void>) | undefined
}

export function TaskForm({ task, isOpen, onClose, onSave, onDelete }: TaskFormProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { isMobile } = usePlatform()
  const { aspects, refreshAspects } = useAspects()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [hasDueDate, setHasDueDate] = useState(false)
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [loading, setLoading] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [isAspectFormOpen, setIsAspectFormOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [timePickerValue, setTimePickerValue] = useState(() => dateToPickerValue(new Date()))

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      // Handle different aspect field names
      setCategory(task.aspect_name || task.aspect || '')

      // Parse due date
      if (task.due_date) {
        const dueDateTime = new Date(task.due_date)
        if (!isNaN(dueDateTime.getTime())) {
          setDueDate(dueDateTime)
          setHasDueDate(true)
        } else {
          setDueDate(null)
          setHasDueDate(false)
        }
      } else {
        setDueDate(null)
        setHasDueDate(false)
      }

      setPriority(task.priority || 'medium')
    } else {
      setTitle('')
      setDescription('')
      setCategory('')
      setDueDate(null)
      setHasDueDate(false)
      setPriority('medium')
    }
    // Close dropdown when form opens/closes
    setShowCategoryDropdown(false)
    setShowTimePicker(false)
  }, [task, isOpen])

  // Click-outside to close category dropdown
  useEffect(() => {
    if (!showCategoryDropdown) return

    const handleMouseDown = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [showCategoryDropdown])

  // Sync time picker value with dueDate
  useEffect(() => {
    if (dueDate) {
      setTimePickerValue(dateToPickerValue(dueDate))
    }
  }, [dueDate])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const taskData: Partial<Task> = {
        title: title.trim(),
        priority,
        status: 'pending'
      }
      if (task?.id) taskData.id = task.id
      if (description.trim()) taskData.description = description.trim()
      if (category) taskData.aspect = category
      if (hasDueDate && dueDate) taskData.due_date = dueDate.toISOString()
      await onSave(taskData)
      onClose()
      setShowCategoryDropdown(false)
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Failed to save task. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAspect = async (aspectData: Partial<Aspect>) => {
    if (!user || !session) return

    try {
      await createUserAspect(user, aspectData as any, session.access_token)
      await refreshAspects()
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

  const getAspectColor = (aspectName: string): string => {
    const asp = aspects.find(a => a.name === aspectName)
    return asp?.color || '#999'
  }

  const titleInput = (
    <input
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      required
      placeholder="Task title"
      style={{
        width: '100%',
        padding: '0',
        fontSize: fontSize.xl,
        fontWeight: fontWeight.semibold,
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
      preventAutoFocus={!!task}
    >
      <form onSubmit={handleSubmit} style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>

          {/* Aspect */}
          <div ref={categoryDropdownRef} style={{ position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
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
                fontSize: fontSize.base,
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
                    background: getAspectColor(category),
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
                    fontSize: fontSize.base,
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
                {aspects.map(cat => (
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
                      fontSize: fontSize.base,
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
                    fontSize: fontSize.base,
                    color: isDarkMode ? '#f0f0f0' : '#000',
                    fontWeight: fontWeight.medium,
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

          {/* Priority */}
          <div>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
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
                fontSize: fontSize.base,
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

          {/* Due Date */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: hasDueDate ? '8px' : 0
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={hasDueDate}
                  onChange={(e) => {
                    setHasDueDate(e.target.checked)
                    if (e.target.checked && !dueDate) {
                      // Default to tomorrow at 5 PM
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      tomorrow.setHours(17, 0, 0, 0)
                      setDueDate(tomorrow)
                    }
                  }}
                  style={{ width: '18px', height: '18px', accentColor: colors.textPrimary }}
                />
                <span style={{ fontSize: fontSize.base, color: colors.textPrimary }}>Set due date</span>
              </label>
            </div>

            {hasDueDate && dueDate && (
              isMobile ? (
                <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div
                    onClick={() => setShowDatePicker(true)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: fontSize.base,
                      background: colors.bgPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>Due</span>
                    {formatDate(dueDate)}
                  </div>
                  <div
                    onClick={() => setShowTimePicker(!showTimePicker)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: fontSize.base,
                      background: showTimePicker ? colors.bgHover : colors.bgPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {formatTime(dueDate)}
                  </div>
                </div>

                {/* Inline Time Picker */}
                {showTimePicker && (
                  <div style={{
                    marginTop: '8px',
                    background: colors.bgPrimary,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    overflow: 'hidden'
                  }}>
                    <Picker
                      value={timePickerValue}
                      onChange={(val) => {
                        setTimePickerValue(val)
                        setDueDate(pickerValueToDate(val, dueDate))
                      }}
                      height={150}
                      itemHeight={36}
                      wheelMode="natural"
                    >
                      <Picker.Column name="hour">
                        {HOURS.map(h => (
                          <Picker.Item key={h} value={h}>
                            {({ selected }) => (
                              <div style={{
                                fontSize: '18px',
                                fontWeight: selected ? '600' : '400',
                                color: selected ? colors.textPrimary : colors.textSecondary
                              }}>
                                {h}
                              </div>
                            )}
                          </Picker.Item>
                        ))}
                      </Picker.Column>
                      <Picker.Column name="minute">
                        {MINUTES.map(m => (
                          <Picker.Item key={m} value={m}>
                            {({ selected }) => (
                              <div style={{
                                fontSize: '18px',
                                fontWeight: selected ? '600' : '400',
                                color: selected ? colors.textPrimary : colors.textSecondary
                              }}>
                                {m}
                              </div>
                            )}
                          </Picker.Item>
                        ))}
                      </Picker.Column>
                      <Picker.Column name="period">
                        {PERIODS.map(p => (
                          <Picker.Item key={p} value={p}>
                            {({ selected }) => (
                              <div style={{
                                fontSize: '18px',
                                fontWeight: selected ? '600' : '400',
                                color: selected ? colors.textPrimary : colors.textSecondary
                              }}>
                                {p}
                              </div>
                            )}
                          </Picker.Item>
                        ))}
                      </Picker.Column>
                    </Picker>
                  </div>
                )}
                </>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <DatePickerWeb
                      value={dueDate}
                      onChange={setDueDate}
                      colors={colors}
                      inputStyle={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: fontSize.base,
                        background: colors.bgPrimary,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TimeInputWeb
                      value={dueDate}
                      onChange={setDueDate}
                      colors={colors}
                      inputStyle={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: fontSize.base,
                        background: colors.bgPrimary,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                </div>
              )
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
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
                fontSize: fontSize.base,
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
            alignItems: 'center',
            paddingTop: '16px',
            borderTop: `1px solid ${colors.border}`
          }}>
            {task && onDelete && (
              <DeleteTextButton
                onClick={async (e) => {
                  e.preventDefault()
                  await onDelete()
                  onClose()
                }}
              />
            )}
            <div style={{ flex: 1 }} />
            <SaveTextButton
              onClick={(e) => handleSubmit(e)}
              disabled={!title.trim()}
              loading={loading}
            />
          </div>
        </form>

      {/* Aspect Form Modal */}
      <AspectForm
        isOpen={isAspectFormOpen}
        onClose={() => setIsAspectFormOpen(false)}
        onSave={handleCreateAspect}
      />

      {/* Date Picker (mobile only) */}
      {isMobile && dueDate && (
        <DatePickerMobile
          value={dueDate}
          onChange={setDueDate}
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </Modal>
  )
}
