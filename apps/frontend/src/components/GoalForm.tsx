import { useState, useEffect, useRef } from 'react'
import Picker from 'react-mobile-picker'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, Category } from '../lib/categoryService'
import { Goal } from '../lib/goalService'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { AspectForm } from './AspectForm'
import { Modal } from './Modal'
import { DatePickerMobile } from './mobile/DatePickerMobile'
import { usePlatform } from '../hooks/usePlatform'
import { SaveTextButton, CancelTextButton } from './ui/IconButtons'

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
  const [milestones, setMilestones] = useState<Array<{ title: string; due_date?: string; completed?: boolean }>>([])
  const [milestoneType, setMilestoneType] = useState<'dated' | 'ordered'>('ordered')
  const [showMilestones, setShowMilestones] = useState(false)
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
      if (goal.milestones && goal.milestones.length > 0) {
        setMilestones(goal.milestones.map(m => ({
          title: m.title,
          due_date: m.due_date,
          completed: m.completed
        })))
        setShowMilestones(true)
      } else {
        setMilestones([])
        setShowMilestones(false)
      }
      // Set milestone type from goal or infer from milestones
      if (goal.milestone_type) {
        setMilestoneType(goal.milestone_type)
      } else if (goal.milestones?.some(m => m.due_date)) {
        setMilestoneType('dated')
      } else {
        setMilestoneType('ordered')
      }
    } else {
      setTitle('')
      setDescription('')
      setCategory('')
      setDueDate(null)
      setHasDueDate(false)
      setMilestones([])
      setMilestoneType('ordered')
      setShowMilestones(false)
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
      if (milestones.length > 0) {
        // Clear due_dates for ordered milestones to avoid confusion
        const processedMilestones = milestones
          .filter(m => m.title.trim())
          .map(m => milestoneType === 'ordered'
            ? { ...m, due_date: undefined }
            : m
          )
        goalData.milestones = processedMilestones
        goalData.milestone_type = milestoneType
      }
      await onSave(goalData)
      onClose()
    } catch (error) {
      console.error('Error saving goal:', error)
      alert('Failed to save goal. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  const addMilestone = () => {
    setMilestones([...milestones, { title: '', completed: false }])
  }

  const updateMilestone = (index: number, field: string, value: string | boolean) => {
    setMilestones(milestones.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    ))
  }

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index))
  }

  const titleInput = (
    <input
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      required
      placeholder="Goal title"
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
      preventAutoFocus={!!goal}
    >
      <form onSubmit={handleSubmit} style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>

          {/* Aspect */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
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
              onClick={() => setEditingField(editingField === 'category' ? null : 'category')}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: fontSize.base,
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
                      fontSize: fontSize.base,
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
                      fontSize: fontSize.base,
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
                    fontSize: fontSize.base,
                    color: colors.textPrimary,
                    fontWeight: fontWeight.medium,
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
                <span style={{ fontSize: fontSize.base, color: colors.textPrimary }}>Set due date</span>
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
                    fontSize: fontSize.base,
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
                        fontSize: fontSize.base,
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
                    fontSize: fontSize.base,
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
                        fontSize: fontSize.base,
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
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what you want to accomplish and why it matters to you..."
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

          {/* Milestones */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: showMilestones || milestones.length > 0 ? '8px' : 0
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={showMilestones || milestones.length > 0}
                  onChange={(e) => {
                    setShowMilestones(e.target.checked)
                    if (e.target.checked && milestones.length === 0) {
                      addMilestone()
                    }
                  }}
                  style={{ width: '18px', height: '18px', accentColor: colors.textPrimary }}
                />
                <span style={{ fontSize: fontSize.base, color: colors.textPrimary }}>Add milestones</span>
              </label>
            </div>

            {(showMilestones || milestones.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Milestone Type Toggle */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <button
                    type="button"
                    onClick={() => setMilestoneType('ordered')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: fontSize.sm,
                      background: milestoneType === 'ordered' ? colors.accent : 'transparent',
                      color: milestoneType === 'ordered' ? '#fff' : colors.textSecondary,
                      border: `1px solid ${milestoneType === 'ordered' ? colors.accent : colors.border}`,
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Steps (no dates)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMilestoneType('dated')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: fontSize.sm,
                      background: milestoneType === 'dated' ? colors.accent : 'transparent',
                      color: milestoneType === 'dated' ? '#fff' : colors.textSecondary,
                      border: `1px solid ${milestoneType === 'dated' ? colors.accent : colors.border}`,
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Timeline (with dates)
                  </button>
                </div>

                {milestones.map((milestone, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    {/* Step number for ordered milestones */}
                    {milestoneType === 'ordered' && (
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: colors.accent,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </span>
                    )}
                    <input
                      type="text"
                      value={milestone.title}
                      onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                      placeholder={milestoneType === 'ordered' ? `Step ${index + 1}` : 'Milestone title'}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: fontSize.sm,
                        background: colors.bgPrimary,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px'
                      }}
                    />
                    {milestoneType === 'dated' && (
                      <input
                        type="date"
                        value={milestone.due_date || ''}
                        onChange={(e) => updateMilestone(index, 'due_date', e.target.value)}
                        style={{
                          padding: '8px 10px',
                          fontSize: fontSize.sm,
                          background: colors.bgPrimary,
                          color: colors.textPrimary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '4px',
                          width: '140px'
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      style={{
                        padding: '6px 10px',
                        fontSize: fontSize.base,
                        background: 'transparent',
                        color: colors.textSecondary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      X
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMilestone}
                  style={{
                    padding: '8px 12px',
                    fontSize: fontSize.sm,
                    background: 'transparent',
                    color: colors.textSecondary,
                    border: `1px dashed ${colors.border}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  + Add {milestoneType === 'ordered' ? 'step' : 'milestone'}
                </button>
              </div>
            )}
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
            {/* <CancelTextButton
              onClick={onClose}
              disabled={loading}
            /> */}
            <SaveTextButton
              onClick={(e) => handleSubmit(e)}
              disabled={!title.trim()}
              loading={loading}
              isCreate={!goal}
            />
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
