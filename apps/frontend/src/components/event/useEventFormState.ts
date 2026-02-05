import { useState, useEffect } from 'react'
import { CalendarEvent } from '../../lib/calendarService'
import { parseRRuleToForm, buildRRuleFromForm, getNextOccurrences } from '../../lib/recurrenceUtils'

export interface RecurrenceState {
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  daysOfWeek: string[]
  dayOfMonth: number
  endType: 'never' | 'after' | 'until'
  count: number
  untilDate: string
}

const defaultRecurrence: RecurrenceState = {
  pattern: 'weekly',
  interval: 1,
  daysOfWeek: ['MO'],
  dayOfMonth: 1,
  endType: 'never',
  count: 10,
  untilDate: ''
}

// Convert Date to picker value for mobile time pickers
export const dateToPickerValue = (date: Date) => {
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
export const pickerValueToDate = (
  pickerValue: { hour: string; minute: string; period: string },
  baseDate: Date
) => {
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

interface UseEventFormStateOptions {
  event: CalendarEvent | null | undefined
  isOpen: boolean
}

export function useEventFormState({ event, isOpen }: UseEventFormStateOptions) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrence, setRecurrence] = useState<RecurrenceState>(defaultRecurrence)
  const [recurrencePreview, setRecurrencePreview] = useState<Date[]>([])

  // Mobile picker states
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [startTimeValue, setStartTimeValue] = useState(() => dateToPickerValue(new Date()))
  const [endTimeValue, setEndTimeValue] = useState(() => dateToPickerValue(new Date()))

  const isEditing = !!event?.id
  const isRecurringEvent = !!(event?.is_recurring || event?.parent_event_id || event?.recurrence_rule)
  const isInstance = !!event?.parent_event_id
  const canSave = title.trim().length > 0

  // Init from event prop when isOpen changes
  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setLocation(event.location || '')
      setDescription(event.description || '')
      setCategory(event.category || '')

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

      // Parse recurrence from existing event
      if (event.recurrence_rule) {
        setIsRecurring(true)
        const parsed = parseRRuleToForm(event.recurrence_rule)
        if (parsed) {
          setRecurrence({
            pattern: parsed.pattern,
            interval: parsed.interval || 1,
            daysOfWeek: parsed.daysOfWeek || ['MO'],
            dayOfMonth: parsed.dayOfMonth || 1,
            endType: parsed.endType || 'never',
            count: parsed.count || 10,
            untilDate: parsed.untilDate instanceof Date && !isNaN(parsed.untilDate.getTime())
              ? parsed.untilDate.toISOString().split('T')[0]
              : ''
          })
        }
      } else if (event.is_recurring || event.parent_event_id) {
        setIsRecurring(true)
      } else {
        setIsRecurring(false)
        setRecurrence({ ...defaultRecurrence })
      }
    } else {
      // Reset for new event
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

      setIsRecurring(false)
      setRecurrence({ ...defaultRecurrence })
    }
    setRecurrencePreview([])
    setShowDatePicker(false)
    setShowStartTimePicker(false)
    setShowEndTimePicker(false)
  }, [event, isOpen])

  // Sync mobile picker values with dates
  useEffect(() => {
    setStartTimeValue(dateToPickerValue(startDate))
  }, [startDate])

  useEffect(() => {
    setEndTimeValue(dateToPickerValue(endDate))
  }, [endDate])

  // Update recurrence preview
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
      const rruleParams: Parameters<typeof buildRRuleFromForm>[0] = {
        pattern: recurrence.pattern,
        interval: recurrence.interval,
        daysOfWeek: recurrence.pattern === 'weekly' ? recurrence.daysOfWeek : [],
        dayOfMonth: recurrence.pattern === 'monthly' ? recurrence.dayOfMonth : 1,
        endType: recurrence.endType,
        ...(recurrence.endType === 'after' && { count: recurrence.count }),
        ...(recurrence.endType === 'until' && recurrence.untilDate && {
          untilDate: new Date(recurrence.untilDate)
        })
      }
      const rrule = buildRRuleFromForm(rruleParams)
      const occurrences = getNextOccurrences(rrule, startDate, 3)
      setRecurrencePreview(occurrences)
    } catch {
      setRecurrencePreview([])
    }
  }, [isRecurring, startDate, recurrence])

  // Date/time input helpers
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0] ?? ''
  }

  const formatTimeForInput = (date: Date): string => {
    return date.toTimeString().slice(0, 5)
  }

  const formatDateDisplay = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  const formatTimeDisplay = (date: Date): string => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  const handleDateChange = (dateStr: string, isStart: boolean) => {
    const currentDate = isStart ? startDate : endDate
    const parts = dateStr.split('-').map(Number)
    const year = parts[0] ?? 0
    const month = parts[1] ?? 1
    const day = parts[2] ?? 1
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
    const parts = timeStr.split(':').map(Number)
    const hours = parts[0] ?? 0
    const minutes = parts[1] ?? 0
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

  const updateRecurrence = (updates: Partial<RecurrenceState>) => {
    setRecurrence(prev => ({ ...prev, ...updates }))
  }

  return {
    // Form fields
    title, setTitle,
    location, setLocation,
    description, setDescription,
    category, setCategory,
    startDate, setStartDate,
    endDate, setEndDate,
    loading, setLoading,

    // Recurrence
    isRecurring, setIsRecurring,
    recurrence, updateRecurrence,
    recurrencePreview,

    // Mobile picker states
    showDatePicker, setShowDatePicker,
    showStartTimePicker, setShowStartTimePicker,
    showEndTimePicker, setShowEndTimePicker,
    startTimeValue, setStartTimeValue,
    endTimeValue, setEndTimeValue,

    // Computed
    isEditing,
    isRecurringEvent,
    isInstance,
    canSave,

    // Helpers
    formatDateForInput,
    formatTimeForInput,
    formatDateDisplay,
    formatTimeDisplay,
    handleDateChange,
    handleTimeChange
  }
}
