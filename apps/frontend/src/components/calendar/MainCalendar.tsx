import { useCallback, useMemo, useState } from 'react';
import {
  Calendar as BigCalendar,
  Views,
  dateFnsLocalizer,
  type SlotInfo,
  type View,
  type NavigateAction,
} from 'react-big-calendar';
import withDragAndDrop, { type EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import { addDays, format, parse, startOfToday, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { utcToZonedTime } from 'date-fns-tz';

import type { ExtendedCalendarEvent } from '@/types/calendar';
import { getCategoryColor } from '@/lib/calendarCategories';

const locales = { 'en-US': enUS } as const;

const localizer = dateFnsLocalizer({
  format,
  parse: (value, formatString, backupDate, options) =>
    parse(value, formatString, backupDate, { locale: options?.locale ?? enUS }),
  startOfWeek: (date, options) =>
    startOfWeek(addDays(date, 1), { weekStartsOn: 1, ...(options ?? {}) }),
  getDay,
  locales,
});

type CalendarEventWithDates = ExtendedCalendarEvent & {
  start: Date;
  end: Date;
};

const DragAndDropCalendar = withDragAndDrop<CalendarEventWithDates>(BigCalendar);

export interface CalendarInteractionArgs {
  event: ExtendedCalendarEvent;
  start: Date;
  end?: Date;
  isAllDay?: boolean;
}

export interface MainCalendarProps {
  events: ExtendedCalendarEvent[];
  onSelectEvent?: (event: ExtendedCalendarEvent) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onEventDrop?: (args: CalendarInteractionArgs) => void;
  onEventResize?: (args: CalendarInteractionArgs) => void;
  userTimezone?: string;
}

function toReadableTextColor(color: string): string {
  const hex = color.replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map(char => char + char).join('')
    : hex.padEnd(6, '0');

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 140 ? '#000000' : '#FFFFFF';
}

export function MainCalendar({
  events,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  userTimezone,
}: MainCalendarProps) {
  const [referenceDate, setReferenceDate] = useState<Date>(() => addDays(startOfToday(), -1));
  const [currentView, setCurrentView] = useState<View>(Views.WEEK);

  const displayDate = referenceDate;

  const resolveDate = useCallback(
    (value?: string | Date | null) => {
      if (!value) {
        return null;
      }

      const parsed = typeof value === 'string' ? new Date(value) : value;
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      if (userTimezone && userTimezone !== 'local') {
        return utcToZonedTime(parsed, userTimezone);
      }

      return parsed;
    },
    [userTimezone],
  );

  const normalizedEvents = useMemo(() => {
    return events
      .map(event => {
        const startDate = resolveDate(event.start ?? event.start_time);
        const endDate = resolveDate(event.end ?? event.end_time);

        if (!startDate || !endDate) {
          return null;
        }

        return {
          ...event,
          start: startDate,
          end: endDate,
        } satisfies CalendarEventWithDates;
      })
      .filter((event): event is CalendarEventWithDates => Boolean(event));
  }, [events, resolveDate]);

  const handleNavigate = useCallback(
    (newDate: Date, _view: View, action: NavigateAction) => {
      if (action === 'TODAY') {
        setReferenceDate(addDays(startOfToday(), -1));
        return;
      }

      setReferenceDate(newDate);
    },
    [],
  );

  const handleViewChange = useCallback((view: View) => {
    setCurrentView(view);
    // Maintain the shifted reference date so the current day renders in the second column.
    setReferenceDate(prev => prev);
  }, []);

  const eventPropGetter = useCallback((event: CalendarEventWithDates) => {
    const fallbackColor = getCategoryColor(event.category);
    const baseColor = event.color ?? fallbackColor;
    const textColor = event.textColor ?? toReadableTextColor(baseColor);

    return {
      style: {
        backgroundColor: baseColor,
        borderColor: baseColor,
        color: textColor,
      },
    };
  }, []);

  const handleEventDrop = useCallback(
    (args: EventInteractionArgs<CalendarEventWithDates>) => {
      const startDate = args.start instanceof Date ? args.start : new Date(args.start);
      const endDate = args.end instanceof Date ? args.end : new Date(args.end);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return;
      }

      const eventForCallback: ExtendedCalendarEvent = {
        ...args.event,
        start: args.event.start.toISOString(),
        end: args.event.end.toISOString(),
      };

      onEventDrop?.({
        event: eventForCallback,
        start: startDate,
        end: endDate,
        isAllDay: args.isAllDay,
      });
    },
    [onEventDrop],
  );

  const handleEventResize = useCallback(
    (args: EventInteractionArgs<CalendarEventWithDates>) => {
      const startDate = args.start instanceof Date ? args.start : new Date(args.start);
      const endDate = args.end instanceof Date ? args.end : new Date(args.end);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return;
      }

      const eventForCallback: ExtendedCalendarEvent = {
        ...args.event,
        start: args.event.start.toISOString(),
        end: args.event.end.toISOString(),
      };

      onEventResize?.({
        event: eventForCallback,
        start: startDate,
        end: endDate,
        isAllDay: args.isAllDay,
      });
    },
    [onEventResize],
  );

  return (
    <DragAndDropCalendar
      localizer={localizer}
      date={displayDate}
      view={currentView}
      events={normalizedEvents}
      defaultView={Views.WEEK}
      views={[Views.WEEK]}
      selectable
      resizable
      popup={false}
      onSelectEvent={event => onSelectEvent?.(event)}
      onSelectSlot={slotInfo => onSelectSlot?.(slotInfo)}
      onEventDrop={handleEventDrop}
      onEventResize={handleEventResize}
      onNavigate={handleNavigate}
      onView={handleViewChange}
      step={30}
      timeslots={2}
      longPressThreshold={250}
      startAccessor="start"
      endAccessor="end"
      eventPropGetter={eventPropGetter}
      min={new Date(1970, 0, 1, 0, 0, 0)}
      max={new Date(1970, 0, 1, 24, 0, 0)}
      style={{ height: '100%' }}
    />
  );
}

export default MainCalendar;
