import { useCallback, useMemo, useState } from 'react';
import type { EventProps } from 'react-big-calendar';
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
import './calendar-styles.css';

import { addDays, format, parse, startOfToday, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { toZonedTime } from 'date-fns-tz';

import type { ExtendedCalendarEvent } from '@/types/calendar';
import { getCategoryColor } from '@/lib/calendarCategories';

const locales = { 'en-US': enUS } as const;

const localizer = dateFnsLocalizer({
  format,
  parse: (value, formatString, backupDate, options) =>
    parse(value, formatString, backupDate, { locale: options?.locale ?? enUS }),
  startOfWeek: (date, options) => {
    // Calculate which day should be the start to make "today" the second column
    const today = new Date();
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    // Week should start 1 day before today, so today is in column 2
    const weekStartsOn = (todayDayOfWeek - 1 + 7) % 7;
    return startOfWeek(date, { weekStartsOn, ...(options ?? {}) });
  },
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

// Custom event component for better text display
function CustomEvent({ event }: EventProps<CalendarEventWithDates>) {
  const { title, start, end } = event;
  const startTime = format(start, 'h:mm a');
  const endTime = format(end, 'h:mm a');
  
  return (
    <div className="rbc-event-content" title={`${title} (${startTime} - ${endTime})`}>
      <div className="text-xs opacity-90">{startTime}</div>
      <div className="font-medium my-1">{title}</div>
      <div className="text-xs opacity-90">{endTime}</div>
    </div>
  );
}

export function MainCalendar({
  events,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  userTimezone,
}: MainCalendarProps) {
  const [referenceDate, setReferenceDate] = useState<Date>(() => startOfToday());
  const [currentView, setCurrentView] = useState<View>(Views.WEEK);

  const displayDate = referenceDate;

  const resolveDate = useCallback(
    (value?: string | Date | null) => {
      if (!value) {
        return null;
      }

      // Parse the date string - backend sends ISO 8601 UTC strings like "2025-10-06T14:00:00.000Z"
      const parsed = typeof value === 'string' ? new Date(value) : value;
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      // Debug logging to understand the issue
      console.log('[resolveDate]', {
        input: value,
        parsed: parsed.toISOString(),
        localString: parsed.toLocaleString(),
        hours: parsed.getHours(),
        minutes: parsed.getMinutes()
      });

      return parsed;
    },
    [],
  );

  const normalizedEvents = useMemo(() => {
    const result = events
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
    
    // Debug logging
    console.log('[Calendar] Normalized events:', result.length);
    result.forEach(e => {
      console.log(`  - ${e.title}: ${e.start.toLocaleString()}`);
    });
    
    return result;
  }, [events, resolveDate]);

  const handleNavigate = useCallback(
    (newDate: Date, _view: View, action: NavigateAction) => {
      if (action === 'TODAY') {
        setReferenceDate(startOfToday());
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

  const components = useMemo(() => ({
    event: CustomEvent,
  }), []);

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
      popup={true}
      popupOffset={30}
      getNow={() => new Date()}
      showCurrentTimeIndicator={true}
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
      titleAccessor="title"
      tooltipAccessor="title"
      eventPropGetter={eventPropGetter}
      components={components}
      min={new Date(2000, 0, 1, 0, 0, 0)}
      max={new Date(2000, 0, 1, 23, 59, 59)}
      style={{ height: '100%' }}
      dayLayoutAlgorithm="no-overlap"
    />
  );
}

export default MainCalendar;
