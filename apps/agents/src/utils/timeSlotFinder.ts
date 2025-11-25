import { addDays, startOfDay } from 'date-fns';
import { toDate } from 'date-fns-tz';

export interface TimeSlot {
  startLocal: Date;
  endLocal: Date;
}

export interface SlotFinderOptions {
  dayOffset: number;
  durationMinutes: number;
  earliestMinutes: number;
  latestMinutes: number;
}

/**
 * Find a free time slot in the user's calendar for a given day and duration
 */
export function findFreeSlot(
  events: any[],
  timezone: string,
  options: SlotFinderOptions
): TimeSlot | null {
  const { dayOffset, durationMinutes, earliestMinutes, latestMinutes } = options;

  // Get the target date in the user's timezone
  const now = new Date();
  const targetDate = addDays(now, dayOffset);
  const startOfTargetDay = startOfDay(targetDate);

  // Convert to timezone-aware dates
  const dayStart = toDate(startOfTargetDay, { timeZone: timezone });
  const dayEnd = toDate(addDays(startOfTargetDay, 1), { timeZone: timezone });

  // Filter events for this day
  const dayEvents = events
    .filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      return eventStart < dayEnd && eventEnd > dayStart;
    })
    .map(event => ({
      start: new Date(event.start_time),
      end: new Date(event.end_time)
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Calculate available slots
  const earliestTime = earliestMinutes;
  const latestTime = latestMinutes;
  const searchDate = new Date(dayStart);
  searchDate.setHours(Math.floor(earliestTime / 60), earliestTime % 60, 0, 0);

  let currentSlotStart = searchDate;
  const endOfDay = new Date(dayStart);
  endOfDay.setHours(Math.floor(latestTime / 60), latestTime % 60, 0, 0);

  // Check each event and find gaps
  for (const event of dayEvents) {
    // Can we fit the duration before this event?
    const timeBefore = (event.start.getTime() - currentSlotStart.getTime()) / (1000 * 60);
    if (timeBefore >= durationMinutes) {
      return {
        startLocal: currentSlotStart,
        endLocal: new Date(currentSlotStart.getTime() + durationMinutes * 60 * 1000)
      };
    }
    // Move past this event
    currentSlotStart = event.end;
  }

  // Check if there's space after the last event
  const timeAfter = (endOfDay.getTime() - currentSlotStart.getTime()) / (1000 * 60);
  if (timeAfter >= durationMinutes && currentSlotStart < endOfDay) {
    return {
      startLocal: currentSlotStart,
      endLocal: new Date(currentSlotStart.getTime() + durationMinutes * 60 * 1000)
    };
  }

  return null;
}
