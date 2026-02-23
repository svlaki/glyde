import { useState } from 'react'
import { useAuth } from '../../lib/authContext'
import { useTheme } from '../../lib/themeContext'
import { createRecurringEvent, updateRecurringEvent } from '../../lib/calendarService'
import type { CalendarEvent } from '../../lib/calendarService'
import { buildRRuleFromForm, formatRRuleForDisplay } from '../../lib/recurrenceUtils'
import { usePlatform } from '../../hooks/usePlatform'
import { getColors } from '../../styles/colors'
import { getTypography, fontFamily, fontSize } from '../../styles/typography'
import { Modal } from '../Modal'
import { DeleteButton, DeleteTextButton, SaveTextButton } from '../ui/IconButtons'
import { DatePickerMobile } from '../mobile/DatePickerMobile'
import { TimePickerSlider } from '../mobile/TimePickerSlider'
import { useEventFormState, pickerValueToDate } from './useEventFormState'
import { AspectDropdown } from './AspectDropdown'
import { RecurrencePopover } from './RecurrencePopover'
import { ScopeDialog } from './ScopeDialog'
import { EventShareModal } from './EventShareModal'

interface EventFormUnifiedProps {
  event?: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onSave: (event: Partial<CalendarEvent>) => Promise<void>
  onSaveRecurring?: ((
    event: Partial<CalendarEvent>,
    scope: 'this_instance' | 'entire_series',
    recurrenceRule?: string
  ) => Promise<void>) | undefined
  onDelete?: ((scope?: 'this_instance' | 'entire_series') => Promise<void>) | undefined
  isViewerOnly?: boolean
}

export function EventFormUnified({
  event,
  isOpen,
  onClose,
  onSave,
  onSaveRecurring,
  onDelete,
  isViewerOnly = false
}: EventFormUnifiedProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const form = useEventFormState({ event: event ?? null, isOpen })

  // Check if this is a friend's event (read-only)
  const isFriendEvent = event?.is_friend_event === true

  const [showRecurrencePopover, setShowRecurrencePopover] = useState(false)
  const [scopeDialogAction, setScopeDialogAction] = useState<'save' | 'delete' | null>(null)
  const [pendingSaveData, setPendingSaveData] = useState<Partial<CalendarEvent> | null>(null)
  const [pendingRRule, setPendingRRule] = useState<string | undefined>(undefined)
  const [showShareModal, setShowShareModal] = useState(false)

  // Build rrule from current recurrence state
  const buildCurrentRRule = () => {
    return buildRRuleFromForm({
      pattern: form.recurrence.pattern,
      interval: form.recurrence.interval,
      daysOfWeek: form.recurrence.pattern === 'weekly' ? form.recurrence.daysOfWeek : [],
      dayOfMonth: form.recurrence.pattern === 'monthly' ? form.recurrence.dayOfMonth : 1,
      endType: form.recurrence.endType,
      ...(form.recurrence.endType === 'after' && { count: form.recurrence.count }),
      ...(form.recurrence.endType === 'until' && form.recurrence.untilDate && {
        untilDate: new Date(form.recurrence.untilDate)
      })
    })
  }

  // Get repeat button text
  const getRepeatText = () => {
    if (!form.isRecurring) return 'Does not repeat'
    try {
      const rrule = buildCurrentRRule()
      return formatRRuleForDisplay(rrule)
    } catch {
      return 'Recurring'
    }
  }

  const buildEventData = (): Partial<CalendarEvent> => {
    const startISO = form.startDate.toISOString()
    const endISO = form.endDate.toISOString()

    return {
      ...(event?.id ? { id: event.id } : {}),
      title: form.title.trim(),
      location: form.location.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.aspect ? { aspect: form.aspect } : {}),
      visibility: form.visibility,
      start_time: startISO,
      end_time: endISO,
      ...(form.reflection.trim() ? { reflection: form.reflection.trim() } : {}),
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!form.canSave) return
    if (form.endDate <= form.startDate) {
      alert('End time must be after start time.')
      return
    }

    form.setLoading(true)
    try {
      const eventData = buildEventData()

      // New recurring event: create via recurring API
      if (form.isRecurring && !form.isEditing && user) {
        const rrule = buildCurrentRRule()
        const { event: createdEvent, error } = await createRecurringEvent(
          user,
          form.title.trim(),
          form.startDate.toISOString(),
          rrule,
          form.aspect || 'Personal',
          form.description.trim() || undefined,
          form.location.trim(),
          form.recurrence.endType === 'until' && form.recurrence.untilDate
            ? new Date(form.recurrence.untilDate).toISOString()
            : undefined,
          session?.access_token
        )

        if (error) {
          alert('Failed to create recurring event: ' + error)
          form.setLoading(false)
          return
        }

        await onSave({
          ...(createdEvent?.id ? { id: createdEvent.id } : {}),
          ...eventData
        })
        onClose()
        return
      }

      // Edit recurring event: show scope dialog
      if (form.isRecurringEvent && form.isEditing) {
        const rrule = buildCurrentRRule()
        setPendingSaveData(eventData)
        setPendingRRule(rrule)
        setScopeDialogAction('save')
        form.setLoading(false)
        return
      }

      // Regular save (new non-recurring or edit non-recurring)
      await onSave(eventData)
      onClose()
    } catch (error) {
      console.error('Error saving event:', error)
      alert('Failed to save event. Please try again.')
    } finally {
      form.setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || !event?.id) return

    // Recurring event: show scope dialog
    if (form.isRecurringEvent) {
      setScopeDialogAction('delete')
      return
    }

    form.setLoading(true)
    try {
      await onDelete()
      onClose()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event. Please try again.')
    } finally {
      form.setLoading(false)
    }
  }

  const handleScopeConfirm = async (scope: 'this_instance' | 'entire_series') => {
    const action = scopeDialogAction
    setScopeDialogAction(null)

    if (action === 'delete' && onDelete) {
      form.setLoading(true)
      try {
        await onDelete(scope)
        onClose()
      } catch (error) {
        console.error('Error deleting recurring event:', error)
        alert('Failed to delete recurring event. Please try again.')
      } finally {
        form.setLoading(false)
      }
      return
    }

    if (pendingSaveData && onSaveRecurring) {
      form.setLoading(true)
      try {
        await onSaveRecurring(pendingSaveData, scope, pendingRRule)
        onClose()
      } catch (error) {
        console.error('Error saving recurring event:', error)
        alert('Failed to save recurring event. Please try again.')
      } finally {
        form.setLoading(false)
        setPendingSaveData(null)
        setPendingRRule(undefined)
      }
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '16px',
    fontFamily: fontFamily.sans,
    background: colors.bgTertiary,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s'
  }

  const FormLabel = ({ children }: { children: React.ReactNode }) => (
    <label style={{
      display: 'block',
      ...typography.labelLg,
      fontWeight: 500,
      color: colors.textSecondary,
      marginBottom: '8px'
    }}>
      {children}
    </label>
  )

  // Read-only view for friend's events
  if (isFriendEvent) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        headerContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: colors.bgTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 600,
              color: colors.textSecondary
            }}>
              {event.owner_display_name?.charAt(0)?.toUpperCase() || 'F'}
            </span>
            <div>
              <div style={{ ...typography.headingLg, fontWeight: 600, color: colors.textPrimary }}>
                {event.title}
              </div>
              <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                {event.owner_display_name || 'Friend'}'s event
              </div>
            </div>
          </div>
        }
        maxWidth="400px"
      >
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Time */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <div>
              <div style={{ fontWeight: 500, color: colors.textPrimary }}>
                {form.formatDateDisplay(form.startDate)}
              </div>
              <div style={{ color: colors.textSecondary, fontSize: '14px' }}>
                {form.formatTimeDisplay(form.startDate)} - {form.formatTimeDisplay(form.endDate)}
              </div>
            </div>
          </div>

          {/* Location (if available) */}
          {event.location && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ color: colors.textPrimary }}>{event.location}</span>
            </div>
          )}

          {/* Aspect (if available) */}
          {event.aspect && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span style={{ color: colors.textPrimary }}>{event.aspect}</span>
            </div>
          )}

          {/* Privacy notice */}
          <div style={{
            background: colors.bgTertiary,
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            color: colors.textTertiary,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            This is a friend's event. Some details are hidden for privacy.
          </div>

          {/* Close button */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '12px',
            borderTop: `1px solid ${colors.border}`
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontFamily: fontFamily.sans,
                background: colors.bgTertiary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // Read-only view for shared aspect events where user is a viewer
  if (isViewerOnly && event) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={event.title || 'Event'}
        maxWidth="400px"
      >
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Time */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <div>
              <div style={{ fontWeight: 500, color: colors.textPrimary }}>
                {form.formatDateDisplay(form.startDate)}
              </div>
              <div style={{ color: colors.textSecondary, fontSize: '14px' }}>
                {form.formatTimeDisplay(form.startDate)} - {form.formatTimeDisplay(form.endDate)}
              </div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ color: colors.textPrimary }}>{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px', flexShrink: 0 }}>
                <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
              </svg>
              <span style={{ color: colors.textPrimary, fontSize: '14px' }}>{event.description}</span>
            </div>
          )}

          {/* Glyde Notes (for Google-synced events) */}
          {event.local_notes && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px', flexShrink: 0 }}>
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <div style={{ fontSize: '14px' }}>
                <div style={{ color: colors.textTertiary, fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>Glyde Notes</div>
                <span style={{ color: colors.textPrimary }}>{event.local_notes}</span>
              </div>
            </div>
          )}

          {/* Aspect */}
          {(event.aspect_name || event.aspect) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span style={{ color: colors.textPrimary }}>{event.aspect_name || event.aspect}</span>
            </div>
          )}

          {/* Viewer notice */}
          <div style={{
            background: colors.bgTertiary,
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            color: colors.textTertiary,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            You are a viewer of this shared aspect. Only editors and owners can modify events.
          </div>

          {/* Close button */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '12px',
            borderTop: `1px solid ${colors.border}`
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontFamily: fontFamily.sans,
                background: colors.bgTertiary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={event?.id ? 'Edit Event' : 'New Event'}
        maxWidth="500px"
        preventAutoFocus={!!event?.id}
      >
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0
        }}>
          <div style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            minHeight: 0
          }}>
            {/* Title */}
            <div>
              <FormLabel>Title *</FormLabel>
              <input
                type="text"
                value={form.title}
                onChange={(e) => form.setTitle(e.target.value)}
                required
                placeholder="Event title"
                style={inputStyle}
              />
            </div>

            {/* Location */}
            <div>
              <FormLabel>Location</FormLabel>
              <input
                type="text"
                value={form.location}
                onChange={(e) => form.setLocation(e.target.value)}
                placeholder="Add location"
                style={inputStyle}
              />
            </div>

            {/* Date */}
            <div>
              <FormLabel>Date *</FormLabel>
              {isMobile ? (
                <div
                  onClick={() => form.setShowDatePicker(true)}
                  style={{
                    ...inputStyle,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {form.formatDateDisplay(form.startDate)}
                </div>
              ) : (
                <input
                  type="date"
                  value={form.formatDateForInput(form.startDate)}
                  required
                  onChange={(e) => form.handleDateChange(e.target.value, true)}
                  style={inputStyle}
                />
              )}
            </div>

            {/* Time: Start -> End */}
            <div>
              <FormLabel>Time *</FormLabel>
              {isMobile ? (
                <div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div
                      onClick={() => {
                        form.setShowStartTimePicker(!form.showStartTimePicker)
                        form.setShowEndTimePicker(false)
                      }}
                      style={{
                        ...inputStyle,
                        flex: 1,
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: form.showStartTimePicker ? colors.bgHover : colors.bgTertiary
                      }}
                    >
                      {form.formatTimeDisplay(form.startDate)}
                    </div>
                    <span style={{ color: colors.textTertiary, fontSize: fontSize.base, flexShrink: 0 }}>to</span>
                    <div
                      onClick={() => {
                        form.setShowEndTimePicker(!form.showEndTimePicker)
                        form.setShowStartTimePicker(false)
                      }}
                      style={{
                        ...inputStyle,
                        flex: 1,
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: form.showEndTimePicker ? colors.bgHover : colors.bgTertiary
                      }}
                    >
                      {form.formatTimeDisplay(form.endDate)}
                    </div>
                  </div>

                  {form.showStartTimePicker && (
                    <div style={{ marginTop: '8px' }}>
                      <TimePickerSlider
                        value={form.startTimeValue}
                        onChange={(val) => {
                          form.setStartTimeValue(val)
                          form.setStartDate(pickerValueToDate(val, form.startDate))
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

                  {form.showEndTimePicker && (
                    <div style={{ marginTop: '8px' }}>
                      <TimePickerSlider
                        value={form.endTimeValue}
                        onChange={(val) => {
                          form.setEndTimeValue(val)
                          form.setEndDate(pickerValueToDate(val, form.endDate))
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
              ) : (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="time"
                    value={form.formatTimeForInput(form.startDate)}
                    onChange={(e) => form.handleTimeChange(e.target.value, true)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <span style={{ color: colors.textTertiary, fontSize: fontSize.base, flexShrink: 0 }}>to</span>
                  <input
                    type="time"
                    value={form.formatTimeForInput(form.endDate)}
                    onChange={(e) => form.handleTimeChange(e.target.value, false)}
                    style={{ ...inputStyle, flex: 1 }}
                    required
                  />
                </div>
              )}
            </div>

            {/* Repeat */}
            <div style={{ position: 'relative' }}>
              <FormLabel>Repeat</FormLabel>
              <div
                onClick={() => {
                  if (!form.isRecurring) {
                    form.setIsRecurring(true)
                    setShowRecurrencePopover(true)
                  } else {
                    setShowRecurrencePopover(!showRecurrencePopover)
                  }
                }}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <span>{getRepeatText()}</span>
              </div>

              {form.isRecurring && (
                <RecurrencePopover
                  isOpen={showRecurrencePopover}
                  onClose={() => setShowRecurrencePopover(false)}
                  onRemove={() => form.setIsRecurring(false)}
                  value={form.recurrence}
                  onChange={(state) => {
                    form.updateRecurrence(state)
                  }}
                  preview={form.recurrencePreview}
                />
              )}
            </div>

            {/* Aspect */}
            <AspectDropdown
              value={form.aspect}
              onChange={form.setAspect}
            />

            {/* Visibility + Invite */}
            <div>
              <FormLabel>Who can see this</FormLabel>
              <div style={{
                display: 'flex',
                gap: '8px'
              }}>
                {(['private', 'public'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => form.setVisibility(option)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: '14px',
                      fontFamily: fontFamily.sans,
                      background: form.visibility === option ? colors.accent : colors.bgTertiary,
                      color: form.visibility === option ? '#fff' : colors.textSecondary,
                      border: `1px solid ${form.visibility === option ? colors.accent : colors.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {option === 'private' ? 'Only me' : 'Public'}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    form.setVisibility('shared')
                    setShowShareModal(true)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '14px',
                    fontFamily: fontFamily.sans,
                    background: form.visibility === 'shared' ? colors.accent : colors.bgTertiary,
                    color: form.visibility === 'shared' ? '#fff' : colors.textSecondary,
                    border: `1px solid ${form.visibility === 'shared' ? colors.accent : colors.border}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  Invite
                </button>
              </div>
              <div style={{
                marginTop: '6px',
                fontSize: '12px',
                color: colors.textTertiary
              }}>
                {form.visibility === 'private' && 'Only you can see this event'}
                {form.visibility === 'public' && 'All your friends can see this event'}
                {form.visibility === 'shared' && 'Invited friends can view or edit this event'}
              </div>
            </div>

            {/* Description */}
            <div>
              <FormLabel>Description</FormLabel>
              <textarea
                value={form.description}
                onChange={(e) => form.setDescription(e.target.value)}
                rows={3}
                placeholder="Add any notes or details..."
                style={{
                  ...inputStyle,
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Reflection - only for past events being edited */}
            {form.isPastEvent && form.isEditing && (
              <div>
                <FormLabel>Reflection</FormLabel>
                <textarea
                  value={form.reflection}
                  onChange={(e) => form.setReflection(e.target.value)}
                  rows={3}
                  placeholder="What happened? How did it go?"
                  style={{
                    ...inputStyle,
                    resize: 'vertical'
                  }}
                />
                <div style={{
                  marginTop: '4px',
                  fontSize: '12px',
                  color: colors.textTertiary
                }}>
                  Add notes about how this event went
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '8px',
              justifyContent: event?.id ? 'space-between' : 'flex-end',
              paddingTop: '20px',
              borderTop: `1px solid ${colors.border}`
            }}>
              {event?.id && onDelete && (
                isMobile ? (
                  <DeleteTextButton
                    onClick={handleDelete}
                    loading={form.loading}
                    mobile
                  />
                ) : (
                  <DeleteButton
                    onClick={handleDelete}
                    disabled={form.loading}
                    title="Delete event"
                  />
                )
              )}

              <SaveTextButton
                onClick={(e) => handleSubmit(e)}
                disabled={!form.canSave}
                loading={form.loading}
                isCreate={!event?.id}
                mobile={isMobile}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Mobile Date Picker */}
      {isMobile && (
        <DatePickerMobile
          value={form.startDate}
          onChange={(newDate) => {
            const newStart = new Date(form.startDate)
            newStart.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
            form.setStartDate(newStart)

            const newEnd = new Date(form.endDate)
            newEnd.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
            form.setEndDate(newEnd)
          }}
          isOpen={form.showDatePicker}
          onClose={() => form.setShowDatePicker(false)}
        />
      )}

      {/* Scope Dialog for recurring events */}
      {scopeDialogAction && (
        <ScopeDialog
          isOpen={!!scopeDialogAction}
          onClose={() => {
            setScopeDialogAction(null)
            setPendingSaveData(null)
            setPendingRRule(undefined)
          }}
          action={scopeDialogAction}
          isInstance={form.isInstance}
          onConfirm={handleScopeConfirm}
        />
      )}

      {/* Share/Invite modal */}
      <EventShareModal
        eventId={event?.id}
        eventTitle={form.title}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </>
  )
}
