import { useState, useEffect, useRef } from 'react'
import Picker from 'react-mobile-picker'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, Category } from '../lib/categoryService'
import { Goal } from '../lib/goalService'
import { getColors } from '../styles/colors'
import { AspectForm } from './AspectForm'
import { Modal } from './Modal'
import { DatePickerMobile } from './mobile/DatePickerMobile'
import { usePlatform } from '../hooks/usePlatform'

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

interface GoalFormProps {
  goal?: Goal
  isOpen: boolean
  onClose: () => void
  onSave: (goal: Partial<Goal>) => Promise<void>
}

export function GoalForm({ goal, isOpen, onClose, onSave }: GoalFormProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories, refreshCategories, getCategoryColor } = useCategories()
  const { isMobile } = usePlatform()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [hasDueDate, setHasDueDate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [isAspectFormOpen, setIsAspectFormOpen] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [timePickerValue, setTimePickerValue] = useState(() => dateToPickerValue(new Date()))
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (goal) {
      setTitle(goal.title || '')
      setDescription(goal.description || '')
      setCategory(goal.category || '')
      if ((goal as any).due_date) {
        setDueDate(new Date((goal as any).due_date))
        setHasDueDate(true)
      } else {
        setDueDate(null)
        setHasDueDate(false)
      }
    } else {
      setTitle('')
      setDescription('')
      setCategory('')
      setDueDate(null)
      setHasDueDate(false)
    }
    setEditingField(null)
  }, [goal, isOpen])

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditingField(null)
      }
    }

    if (editingField) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingField])

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
      setEditingField(null)
    } catch (error) {
      console.error('Error creating aspect:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const goalData: any = {
        id: goal?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category || undefined
      }
      if (hasDueDate && dueDate) {
        goalData.due_date = dueDate.toISOString()
      }
      console.log('Saving goal with data:', goalData)
      await onSave(goalData)
      onClose()
    } catch (error) {
      console.error('Error saving goal:', error)
      alert('Failed to save goal. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goal ? 'Edit Goal' : 'Create New Goal'}
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
              Goal Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Learn to play piano, Get in shape, Start a business"
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
          <div style={{ position: 'relative' }} ref={dropdownRef}>
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
              onClick={() => setEditingField(editingField === 'category' ? null : 'category')}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: category ? colors.textPrimary : colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {category ? (
                <>
                  {(() => {
                    const cat = categories.find(c => c.name === category)
                    return cat ? (
                      <>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: getCategoryColor(category),
                          flexShrink: 0
                        }} />
                        <span>{category}</span>
                      </>
                    ) : (
                      <span>{category}</span>
                    )
                  })()}
                </>
              ) : (
                <span>Select or create an aspect</span>
              )}
            </div>

            {/* Dropdown Menu */}
            {editingField === 'category' && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: colors.bgPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {/* Clear selection option */}
                {category && (
                  <div
                    onClick={() => {
                      setCategory('')
                      setEditingField(null)
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '14px',
                      color: colors.textSecondary,
                      fontStyle: 'italic',
                      borderBottom: `1px solid ${colors.border}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span>Clear aspect</span>
                  </div>
                )}
                {/* Existing aspects */}
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.name)
                      setEditingField(null)
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '14px',
                      color: colors.textPrimary
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: getCategoryColor(cat.name),
                      flexShrink: 0
                    }} />
                    <span>{cat.name}</span>
                  </div>
                ))}
                {/* Create new aspect button */}
                <div
                  onClick={() => {
                    setIsAspectFormOpen(true)
                  }}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                    fontWeight: '500',
                    borderTop: `1px solid ${colors.border}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>+</span>
                  <span>New Aspect</span>
                </div>
              </div>
            )}
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
                <span style={{ fontSize: '14px', color: colors.textPrimary }}>Set due date</span>
              </label>
            </div>

            {hasDueDate && dueDate && (
              <>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div
                  onClick={() => isMobile && setShowDatePicker(true)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '14px',
                    background: colors.bgPrimary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textPrimary,
                    cursor: isMobile ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>📅</span>
                  {isMobile ? (
                    formatDate(dueDate)
                  ) : (
                    <input
                      type="date"
                      value={dueDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(dueDate)
                        const [year, month, day] = e.target.value.split('-').map(Number)
                        newDate.setFullYear(year, month - 1, day)
                        setDueDate(newDate)
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: colors.textPrimary,
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    />
                  )}
                </div>
                <div
                  onClick={() => isMobile && setShowTimePicker(!showTimePicker)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '14px',
                    background: showTimePicker ? colors.bgHover : colors.bgPrimary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textPrimary,
                    cursor: isMobile ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isMobile ? (
                    formatTime(dueDate)
                  ) : (
                    <input
                      type="time"
                      value={`${dueDate.getHours().toString().padStart(2, '0')}:${dueDate.getMinutes().toString().padStart(2, '0')}`}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number)
                        const newDate = new Date(dueDate)
                        newDate.setHours(hours, minutes)
                        setDueDate(newDate)
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: colors.textPrimary,
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Inline Time Picker for Mobile */}
              {isMobile && showTimePicker && (
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
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe what you want to accomplish and why it matters to you..."
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
              {loading ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
            </button>
          </div>
        </form>

      {/* Aspect Form Modal */}
      <AspectForm
        isOpen={isAspectFormOpen}
        onClose={() => setIsAspectFormOpen(false)}
        onSave={handleCreateAspect}
      />

      {/* Mobile Date Picker */}
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
