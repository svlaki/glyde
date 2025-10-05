import type { CalendarEvent } from '../lib/calendarService';

export type ExtendedCalendarEvent = CalendarEvent & {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  start?: string;
  end?: string;
};
