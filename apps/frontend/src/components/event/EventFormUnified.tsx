import { useState } from 'react'
import { useAuth } from '../../lib/authContext'
import { useDarkMode } from '../../lib/darkModeContext'
import { CalendarEvent, createRecurringEvent, updateRecurringEvent } from '../../lib/calendarService'
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

interface EventFormUnifiedProps {
  event?: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onSave: (event: Partial<CalendarEvent>) => Promise<void>
  onSaveRecurring?: (
    event: Partial<CalendarEvent>,
    scope: 'this_instance' | 'entire_series',
    recurrenceRule?: string
  ) => Promise<void>
  onDelete?: (scope?: 'this_instance' | 'entire_series') => Promise<void>
}

export function EventFormUnified({
  event,
  isOpen,
  onClose,
  onSave,
  onSaveRecurring,
  onDelete
}: EventFormUnifiedProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const typography = getTypography(isMobile)

  const form = useEventFormState({ event: event ?? null, isOpen })

  const [showRecurrencePopover, setShowRecurrencePopover] = useState(false)
  const [scopeDialogAction, setScopeDialogAction] = useState<'save' | 'delete' | null>(null)
  const [pendingSaveData, setPendingSaveData] = useState<Partial<CalendarEvent> | null>(null)
  const [pendingRRule, setPendingRRule] = useState<string | undefined>(undefined)

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
      ...(form.category ? { category: form.category } : {}),
      start_time: startISO,
      end_time: endISO
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
          form.category || 'Personal',
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
    setScopeDialogAction(null)

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
    } else if (onDelete) {
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

  const titleInput = (
    <input
      type="text"
      value={form.title}
      onChange={(e) => form.setTitle(e.target.value)}
      required
      placeholder="Event title"
      style={{
        width: '100%',
        padding: '0',
        ...typography.headingLg,
        fontWeight: 600,
        background: 'transparent',
        color: colors.textPrimary,
        border: 'none',
        outline: 'none'
      }}
    />
  )

  return (
    <>
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
          <div style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0
          }}>
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
              value={form.category}
              onChange={form.setCategory}
            />

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
    </>
  )
}
