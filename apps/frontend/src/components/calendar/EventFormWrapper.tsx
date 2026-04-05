import { memo } from 'react'
import type { CalendarEvent } from '../../lib/calendarService'
import { EventFormUnified } from '../event'

type RecurrenceScope = 'this_instance' | 'entire_series'

interface EventFormWrapperProps {
  selectedEvent: CalendarEvent | null
  isFormOpen: boolean
  isViewerOnly: boolean
  onClose: () => void
  onSave: (eventData: Partial<CalendarEvent>) => Promise<void>
  onSaveRecurring?: ((eventData: Partial<CalendarEvent>, scope: RecurrenceScope, recurrenceRule?: string) => Promise<void>) | undefined
  onToggleMissed?: (event: CalendarEvent) => void
  onDelete?: ((scope?: RecurrenceScope) => Promise<void>) | undefined
}

export const EventFormWrapper = memo(function EventFormWrapper({
  selectedEvent,
  isFormOpen,
  isViewerOnly,
  onClose,
  onSave,
  onSaveRecurring,
  onToggleMissed,
  onDelete,
}: EventFormWrapperProps) {
  const formProps: Record<string, unknown> = {
    event: selectedEvent,
    isOpen: isFormOpen,
    onClose,
    isViewerOnly,
    onSave: isViewerOnly ? async () => {} : onSave,
  }
  if (!isViewerOnly) {
    if (onSaveRecurring) formProps.onSaveRecurring = onSaveRecurring
    if (onToggleMissed) formProps.onToggleMissed = onToggleMissed
    if (onDelete) formProps.onDelete = onDelete
  }

  return <EventFormUnified {...formProps as any} />
})
