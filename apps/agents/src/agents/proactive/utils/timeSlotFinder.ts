import { addDays, addMinutes, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TimeSlot } from '../types.js';

/**
 * Finds a free time slot in the user's calendar for a given duration.
 *
 * @param events - Array of calendar events
 * @param timezone - User's timezone
 * @param options - Configuration for the slot finder
 * @returns TimeSlot if found, null otherwise
 */
export function findFreeSlot(
  events: any[],
  timezone: string,
  options: { dayOffset: number; durationMinutes: number; earliestMinutes?: number; latestMinutes?: number }
): TimeSlot | null {
  const { dayOffset, durationMinutes } = options;
  const earliestMinutes = options.earliestMinutes ?? 9 * 60; // Default: 9 AM
  const latestMinutes = options.latestMinutes ?? 19 * 60;    // Default: 7 PM

  // Get the current time in user's timezone
  const nowInZone = toZonedTime(new Date(), timezone);
  const targetDayStart = addDays(startOfDay(nowInZone), dayOffset);

  // If looking for time today, start from current time + 15 min buffer
  const nowMinutes = nowInZone.getHours() * 60 + nowInZone.getMinutes();
  let cursor = dayOffset === 0 ? Math.max(earliestMinutes, nowMinutes + 15) : earliestMinutes;

  // Convert events to minute-based intervals for the target day
  const dayEvents = events
    .map((event: any) => ({
      start: toZonedTime(new Date(event.start_time), timezone),
      end: toZonedTime(new Date(event.end_time), timezone)
    }))
    .filter(({ start, end }) => {
      // Filter events that occur on the target day
      const startDay = startOfDay(start).getTime();
      const targetDay = startOfDay(targetDayStart).getTime();
      const endDay = startOfDay(end).getTime();
      return startDay === targetDay || endDay === targetDay;
    })
    .map(({ start, end }) => {
      // Convert to minutes of day
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      return {
        start: Math.max(startMinutes, earliestMinutes),
        end: Math.min(endMinutes, latestMinutes)
      };
    })
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start);

  // Find gaps between events
  for (const interval of dayEvents) {
    if (interval.start - cursor >= durationMinutes) {
      // Found a gap before this event
      const slotStart = addMinutes(targetDayStart, cursor);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      return { startLocal: slotStart, endLocal: slotEnd };
    }
    cursor = Math.max(cursor, interval.end);
  }

  // Check if there's space after the last event
  if (latestMinutes - cursor >= durationMinutes) {
    const slotStart = addMinutes(targetDayStart, cursor);
    const slotEnd = addMinutes(slotStart, durationMinutes);
    return { startLocal: slotStart, endLocal: slotEnd };
  }

  return null;
}
